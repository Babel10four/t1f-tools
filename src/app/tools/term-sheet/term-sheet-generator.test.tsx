import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEAL_FORM_SESSION_STORAGE_KEY } from "../shared/deal-form-session";
import { TermSheetGeneratorClient } from "./term-sheet-generator-client";
import { TermSheetPreview } from "./term-sheet-preview";
import type { DealAnalyzeResponseV1 } from "@/lib/engines/deal/schemas/canonical-response";

afterEach(() => {
  cleanup();
});

const minimalSuccess: DealAnalyzeResponseV1 = {
  schemaVersion: "deal_analyze.v1",
  analysis: { status: "complete", flags: [] },
  loan: {
    purpose: "purchase",
    productType: "bridge_purchase",
    termMonths: null,
    rehabBudget: 0,
    purchasePrice: 100_000,
    amount: 75_000,
    ltv: 75,
  },
  pricing: {
    status: "complete",
    noteRatePercent: null,
    marginBps: null,
    discountPoints: null,
    lockDays: null,
  },
  cashToClose: {
    status: "complete",
    estimatedTotal: 1000,
    items: [{ label: "First line", amount: 400 }, { label: "Second line", amount: 600 }],
  },
  risks: [],
};

describe("TermSheetGeneratorClient", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify(minimalSuccess), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it("clear saved deal inputs removes session storage", async () => {
    sessionStorage.setItem(
      DEAL_FORM_SESSION_STORAGE_KEY,
      JSON.stringify({
        flow: "purchase",
        fields: {
          purchasePrice: "1",
          rehabBudget: "",
          arv: "",
          requestedLoanAmount: "",
          termMonths: "",
          fico: "",
          experienceTier: "",
          payoffAmount: "",
          asIsValue: "",
          borrowingRehabFunds: "yes",
          originationPointsPercent: "",
          originationFlatFee: "",
          noteRatePercent: "",
          collateralPropertyAddress: "",
        },
      }),
    );
    const user = userEvent.setup();
    render(<TermSheetGeneratorClient />);
    await user.click(screen.getByTestId("ts-clear-deal-session"));
    expect(sessionStorage.getItem(DEAL_FORM_SESSION_STORAGE_KEY)).toBeNull();
  });

  it("purchase happy path posts canonical body and shows disclaimer + preview", async () => {
    const user = userEvent.setup();
    render(<TermSheetGeneratorClient />);
    const form = screen.getByTestId("ts-form");
    await user.type(within(form).getByTestId("ts-purchase-price"), "100000");
    await user.type(within(form).getByTestId("ts-purchase-arv"), "200000");
    await user.click(screen.getByTestId("ts-generate-button"));
    await waitFor(() => {
      expect(screen.getByTestId("ts-preview")).toBeInTheDocument();
    });
    expect(screen.getByTestId("ts-disclaimer")).toHaveTextContent(
      /Indicative, non-binding preview only/i,
    );
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.deal.purpose).toBe("purchase");
    expect(body.deal.productType).toBe("bridge_purchase");
    expect(body.internalDealLabel).toBeUndefined();
    expect(body.counterpartyLabel).toBeUndefined();
    expect(body.propertyLabel).toBeUndefined();
    expect(body.preparedBy).toBeUndefined();
    expect(body.preparedDate).toBeUndefined();
    expect(body.deal.requestedLoanAmount).toBe(90_000);
  });

  it("autosuggests purchase requested loan as 90% of price plus rehab when borrowing rehab", async () => {
    const user = userEvent.setup();
    render(<TermSheetGeneratorClient />);
    const form = screen.getByTestId("ts-form");
    await user.type(within(form).getByTestId("ts-purchase-price"), "100000");
    await user.type(within(form).getByTestId("ts-purchase-rehab"), "25000");
    await waitFor(() => {
      expect(within(form).getByTestId("ts-purchase-requested")).toHaveValue("115000");
    });
  });

  it("autosuggests purchase requested loan as 90% only when not borrowing rehab funds", async () => {
    const user = userEvent.setup();
    render(<TermSheetGeneratorClient />);
    const form = screen.getByTestId("ts-form");
    await user.type(within(form).getByTestId("ts-purchase-price"), "100000");
    await user.type(within(form).getByTestId("ts-purchase-rehab"), "25000");
    await user.click(within(form).getByTestId("ts-borrowing-rehab-no"));
    await waitFor(() => {
      expect(within(form).getByTestId("ts-purchase-requested")).toHaveValue("90000");
    });
  });

  it("stops overwriting requested loan after the borrower types a manual amount", async () => {
    const user = userEvent.setup();
    render(<TermSheetGeneratorClient />);
    const form = screen.getByTestId("ts-form");
    await user.type(within(form).getByTestId("ts-purchase-price"), "100000");
    await waitFor(() => {
      expect(within(form).getByTestId("ts-purchase-requested")).toHaveValue("90000");
    });
    const requested = within(form).getByTestId("ts-purchase-requested");
    await user.clear(requested);
    await user.type(requested, "77777");
    await user.clear(within(form).getByTestId("ts-purchase-price"));
    await user.type(within(form).getByTestId("ts-purchase-price"), "200000");
    expect(requested).toHaveValue("77777");
  });

  it("refinance happy path uses bridge_refinance", async () => {
    const user = userEvent.setup();
    render(<TermSheetGeneratorClient />);
    const form = screen.getByTestId("ts-form");
    await user.click(screen.getByTestId("ts-flow-refinance"));
    await user.type(within(form).getByTestId("ts-refi-payoff"), "300000");
    await user.type(within(form).getByTestId("ts-refi-asis"), "500000");
    await user.click(screen.getByTestId("ts-generate-button"));
    await waitFor(() => {
      expect(screen.getByTestId("ts-preview")).toBeInTheDocument();
    });
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.deal.purpose).toBe("refinance");
    expect(body.deal.productType).toBe("bridge_refinance");
  });

  it("metadata appears in preview and is excluded from request body", async () => {
    const user = userEvent.setup();
    render(<TermSheetGeneratorClient />);
    const form = screen.getByTestId("ts-form");
    await user.type(within(form).getByTestId("ts-purchase-price"), "100000");
    await user.type(within(form).getByTestId("ts-meta-internal-deal"), "Deal-X");
    await user.type(within(form).getByTestId("ts-meta-counterparty"), "Borrower LLC");
    await user.click(screen.getByTestId("ts-generate-button"));
    await waitFor(() => {
      expect(screen.getByTestId("ts-preview")).toBeInTheDocument();
    });
    expect(screen.getByText("Deal-X")).toBeInTheDocument();
    expect(screen.getByText("Borrower LLC")).toBeInTheDocument();
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body).not.toHaveProperty("internalDealLabel");
    expect(body).not.toHaveProperty("counterpartyLabel");
  });

  it("posts lender points and loan fee in assumptions when provided", async () => {
    const user = userEvent.setup();
    render(<TermSheetGeneratorClient />);
    const form = screen.getByTestId("ts-form");
    await user.type(within(form).getByTestId("ts-purchase-price"), "100000");
    await user.type(within(form).getByTestId("ts-purchase-arv"), "200000");
    await user.type(within(form).getByTestId("ts-origination-points"), "2");
    await user.type(within(form).getByTestId("ts-origination-flat-fee"), "1500");
    await user.click(screen.getByTestId("ts-generate-button"));
    await waitFor(() => {
      expect(screen.getByTestId("ts-preview")).toBeInTheDocument();
    });
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.assumptions).toMatchObject({
      originationPointsPercent: 2,
      originationFlatFee: 1500,
      borrowingRehabFunds: true,
    });
  });

  it("posts borrowingRehabFunds=false when user selects no", async () => {
    const user = userEvent.setup();
    render(<TermSheetGeneratorClient />);
    const form = screen.getByTestId("ts-form");
    await user.type(within(form).getByTestId("ts-purchase-price"), "100000");
    await user.click(within(form).getByTestId("ts-borrowing-rehab-no"));
    await user.click(screen.getByTestId("ts-generate-button"));
    await waitFor(() => {
      expect(screen.getByTestId("ts-preview")).toBeInTheDocument();
    });
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.assumptions).toMatchObject({
      borrowingRehabFunds: false,
    });
  });

  it("renders 4xx panel with error, code, and issues", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              error: "Bad request",
              code: "VALIDATION_FAILED",
              issues: [{ path: "deal.purchasePrice", message: "Required." }],
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          ),
        ),
      ),
    );
    const user = userEvent.setup();
    render(<TermSheetGeneratorClient />);
    await user.type(
      within(screen.getByTestId("ts-form")).getByTestId("ts-purchase-price"),
      "100000",
    );
    await user.click(screen.getByTestId("ts-generate-button"));
    await waitFor(() => {
      expect(screen.getByTestId("ts-error-4xx")).toBeInTheDocument();
    });
    expect(screen.getByText("Bad request")).toBeInTheDocument();
    expect(screen.getByText(/VALIDATION_FAILED/)).toBeInTheDocument();
    expect(screen.getByText(/deal.purchasePrice/)).toBeInTheDocument();
  });

  it("renders 5xx without fabricated issues list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(new Response("Internal error", { status: 500 })),
      ),
    );
    const user = userEvent.setup();
    render(<TermSheetGeneratorClient />);
    await user.type(
      within(screen.getByTestId("ts-form")).getByTestId("ts-purchase-price"),
      "100000",
    );
    await user.click(screen.getByTestId("ts-generate-button"));
    await waitFor(() => {
      expect(screen.getByTestId("ts-error-5xx")).toBeInTheDocument();
    });
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("network error uses generic 5xx panel", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("Failed to fetch"))),
    );
    const user = userEvent.setup();
    render(<TermSheetGeneratorClient />);
    await user.type(
      within(screen.getByTestId("ts-form")).getByTestId("ts-purchase-price"),
      "100000",
    );
    await user.click(screen.getByTestId("ts-generate-button"));
    await waitFor(() => {
      expect(screen.getByTestId("ts-error-5xx")).toHaveTextContent(/Failed to fetch/);
    });
  });
});

describe("TermSheetPreview display rules", () => {
  const meta = {
    internalDealLabel: "",
    counterpartyLabel: "",
    propertyLabel: "",
    preparedBy: "",
    preparedDate: "",
  };

  it("shows em dash for null pricing scalars", () => {
    const response: DealAnalyzeResponseV1 = {
      ...minimalSuccess,
      pricing: {
        status: "insufficient_inputs",
        noteRatePercent: null,
        marginBps: null,
        discountPoints: null,
        lockDays: null,
      },
    };
    render(<TermSheetPreview metadata={meta} response={response} />);
    const noteRow = screen.getByTestId("ts-pricing-note-rate");
    expect(noteRow).toHaveTextContent("—");
  });

  it("shows note rate without rounding away fractional precision", () => {
    const response: DealAnalyzeResponseV1 = {
      ...minimalSuccess,
      pricing: {
        status: "complete",
        noteRatePercent: 9.125,
        marginBps: null,
        discountPoints: null,
        lockDays: null,
      },
    };
    render(<TermSheetPreview metadata={meta} response={response} />);
    expect(screen.getByTestId("ts-pricing-note-rate")).toHaveTextContent("9.125%");
  });

  it("shows title/insurance exclusion note and estimate rows", () => {
    const response: DealAnalyzeResponseV1 = {
      ...minimalSuccess,
      cashToClose: {
        status: "insufficient_inputs",
        estimatedTotal: null,
        items: [
          { label: "A", amount: 100 },
          { label: "B", amount: 200 },
        ],
      },
    };
    render(<TermSheetPreview metadata={meta} response={response} />);
    expect(screen.getByTestId("ts-cash-total")).toHaveTextContent(
      /not included in this cash-to-close estimate/i,
    );
    expect(screen.getByTestId("ts-cash-total")).not.toHaveTextContent("$300");
    const items = screen.getByTestId("ts-cash-items");
    expect(items.textContent).toMatch(/Down payment[\s\S]*Loan fees[\s\S]*Interest costs/);
  });

  it("renders normalized estimate labels in order", () => {
    render(<TermSheetPreview metadata={meta} response={minimalSuccess} />);
    const items = screen.getByTestId("ts-cash-items");
    expect(items.textContent).toMatch(
      /Down payment[\s\S]*Loan fees[\s\S]*Interest costs[\s\S]*Estimated cash to close \(excludes title\/insurance\)/,
    );
  });
});
