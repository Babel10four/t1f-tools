import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEAL_FORM_SESSION_STORAGE_KEY, DEFAULT_DEAL_FORM_FIELDS } from "../shared/deal-form-session";
import { TermSheetGeneratorClient } from "./term-sheet-generator-client";
import { TermSheetPreview } from "./term-sheet-preview";
import type { DealAnalyzeResponseV1 } from "@/lib/engines/deal/schemas/canonical-response";
import { runDealAnalyze } from "@/lib/engines/deal/analyze";
import type { PurchaseSuggestionPolicy } from "../loan-structuring-assistant/requested-loan-suggest";

const tier3Policy: PurchaseSuggestionPolicy = {
  purchaseTierRules: {
    "3": { initialAdvancePct: 0.85, rehabAdvancePct: 1, maxArvLtvPct: 0.75 },
  },
};

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
    await user.type(within(form).getByRole("textbox", { name: /Experience tier/ }), "1");
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
    await user.type(within(form).getByRole("textbox", { name: /Experience tier/ }), "1");
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
    await user.type(within(form).getByRole("textbox", { name: /Experience tier/ }), "1");
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
    await user.type(within(form).getByRole("textbox", { name: /Experience tier/ }), "1");
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

  it("uses published Tier 3 rules for Kayla's suggestion without inventing FICO", async () => {
    const user = userEvent.setup();
    render(<TermSheetGeneratorClient calculator={tier3Policy} />);
    const form = within(screen.getByTestId("ts-form"));
    await user.type(form.getByTestId("ts-purchase-price"), "517500");
    await user.type(form.getByTestId("ts-purchase-rehab"), "27500");
    await user.type(form.getByTestId("ts-purchase-arv"), "680000");
    expect(form.getByTestId("ts-purchase-requested")).toHaveValue("");
    await user.type(form.getByRole("textbox", { name: /Experience tier/ }), "3");
    expect(form.getByTestId("ts-purchase-requested")).toHaveValue("467375");
    expect(form.getByText(/Suggested as 85% of purchase price plus 100% of rehab budget/)).toBeInTheDocument();
    await user.click(screen.getByTestId("ts-generate-button"));
    await screen.findByTestId("ts-preview");
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.deal.requestedLoanAmount).toBe(467375);
    expect(body.borrower).toEqual({ experienceTier: "3" });
  });

  it("preserves Kayla's manual requested total when other deal fields change", async () => {
    const user = userEvent.setup();
    render(<TermSheetGeneratorClient calculator={tier3Policy} />);
    const form = within(screen.getByTestId("ts-form"));
    await user.type(form.getByRole("textbox", { name: /Experience tier/ }), "3");
    await user.type(form.getByTestId("ts-purchase-price"), "517500");
    await user.type(form.getByTestId("ts-purchase-rehab"), "27500");
    const requested = form.getByTestId("ts-purchase-requested");
    await user.clear(requested);
    await user.type(requested, "467300");
    await user.type(form.getByTestId("ts-purchase-arv"), "680000");
    expect(requested).toHaveValue("467300");
  });

  it("clears a prior automatic amount when switching to an unconfigured tier", async () => {
    const user = userEvent.setup();
    render(<TermSheetGeneratorClient />);
    const form = within(screen.getByTestId("ts-form"));
    const tier = form.getByRole("textbox", { name: /Experience tier/ });
    await user.type(tier, "1");
    await user.type(form.getByTestId("ts-purchase-price"), "100000");
    expect(form.getByTestId("ts-purchase-requested")).toHaveValue("90000");
    await user.clear(tier);
    await user.type(tier, "3");
    expect(form.getByTestId("ts-purchase-requested")).toHaveValue("");
    expect(form.getByText(/No automatic suggestion is available/)).toBeInTheDocument();
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
    expect(body.programContext).toBeUndefined();
  });

  function fillSyntheticSeasonedRefinance() {
    const form = within(screen.getByTestId("ts-form"));
    for (const [testId, value] of Object.entries({
      "ts-refi-payoff": "700000",
      "ts-refi-requested": "900000",
      "ts-refi-rehab": "200000",
      "ts-refi-arv": "1400000",
      "ts-refi-asis": "1000000",
      "ts-refi-note-rate": "10",
      "ts-refi-origination-points": "0.5",
    })) {
      fireEvent.change(form.getByTestId(testId), { target: { value } });
    }
    fireEvent.change(form.getByRole("textbox", { name: /Experience tier/ }), { target: { value: "1" } });
    fireEvent.change(form.getByRole("textbox", { name: /Term \(months\)/ }), { target: { value: "12" } });
    fireEvent.change(form.getByTestId("ts-closing-date"), { target: { value: "2026-11-09" } });
  }

  it("explicitly selects and persists seasoned refinance, showing the ARV-based financed split", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url, options) => {
      const response = await runDealAnalyze(JSON.parse(options.body));
      return new Response(JSON.stringify(response), { status: 200 });
    }));
    const user = userEvent.setup();
    const view = render(<TermSheetGeneratorClient />);
    await user.click(screen.getByTestId("ts-flow-refinance"));
    fillSyntheticSeasonedRefinance();
    const selection = screen.getByRole("checkbox", { name: "Seasoned refinance with rehab (Tier 0/1)" });
    expect(selection).not.toBeChecked();
    expect(selection).toHaveAccessibleDescription(/more than 180 days.*70% ARV cap/);
    await user.click(selection);
    await user.click(screen.getByTestId("ts-generate-button"));
    const preview = await screen.findByTestId("ts-preview");
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.programContext).toEqual({ scenario: "refinance_seasoned" });
    expect(body.deal).toMatchObject({ payoffAmount: 700_000, requestedLoanAmount: 900_000, rehabBudget: 200_000, termMonths: 12 });
    expect(body.assumptions).toMatchObject({ noteRatePercent: 10, originationPointsPercent: 0.5 });
    expect(body.closingDate).toBeUndefined();
    expect(preview).toHaveTextContent(/Acquisition funds\s*\$700,000/);
    expect(preview).toHaveTextContent(/Rehab loan\s*\$200,000/);
    expect(preview).toHaveTextContent(/Total loan \(64\.3% of ARV\)\s*\$900,000/);
    expect(within(preview).getByTestId("ts-scenario-basis")).toHaveTextContent("70% ARV total-loan cap");
    await waitFor(() => {
      const saved = JSON.parse(sessionStorage.getItem(DEAL_FORM_SESSION_STORAGE_KEY)!);
      expect(saved.fields.refinanceScenario).toBe("refinance_seasoned");
      expect(saved.fields.closingDate).toBe("2026-11-09");
    });
    view.unmount();
    render(<TermSheetGeneratorClient />);
    expect(screen.getByTestId("ts-refi-seasoned-scenario")).toBeChecked();
    expect(screen.getByTestId("ts-closing-date")).toHaveValue("2026-11-09");
  });

  it.each([
    ["ts-refi-arv", ""],
    ["ts-refi-rehab", "0"],
    ["tier", "2"],
    ["borrow", "no"],
  ])("blocks selected seasoned refinance with invalid %s without sending a fallback request", async (field, value) => {
    const user = userEvent.setup();
    render(<TermSheetGeneratorClient />);
    await user.click(screen.getByTestId("ts-flow-refinance"));
    fillSyntheticSeasonedRefinance();
    await user.click(screen.getByTestId("ts-refi-seasoned-scenario"));
    if (field === "borrow") {
      await user.click(screen.getByTestId("ts-refi-borrowing-rehab-no"));
    } else {
      const input = field === "tier"
        ? within(screen.getByTestId("ts-form")).getByRole("textbox", { name: /Experience tier/ })
        : screen.getByTestId(field);
      fireEvent.change(input, { target: { value } });
    }
    await user.click(screen.getByTestId("ts-generate-button"));
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("No fallback calculation has been run");
    expect(screen.getByTestId("ts-refi-seasoned-scenario")).toBeChecked();
  });

  it("deselects the scenario explicitly without changing generic refinance serialization", async () => {
    const user = userEvent.setup();
    render(<TermSheetGeneratorClient />);
    await user.click(screen.getByTestId("ts-flow-refinance"));
    fillSyntheticSeasonedRefinance();
    await user.click(screen.getByTestId("ts-refi-seasoned-scenario"));
    await user.click(screen.getByTestId("ts-refi-seasoned-scenario"));
    await user.click(screen.getByTestId("ts-generate-button"));
    await screen.findByTestId("ts-preview");
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.programContext).toBeUndefined();
  });

  it("clears the scenario when switching back to purchase and does not restore it automatically", async () => {
    const user = userEvent.setup();
    render(<TermSheetGeneratorClient />);
    await user.click(screen.getByTestId("ts-flow-refinance"));
    fillSyntheticSeasonedRefinance();
    await user.click(screen.getByTestId("ts-refi-seasoned-scenario"));
    await user.click(screen.getByTestId("ts-flow-purchase"));
    fireEvent.change(screen.getByTestId("ts-purchase-price"), { target: { value: "1000000" } });
    await user.click(screen.getByTestId("ts-generate-button"));
    await screen.findByTestId("ts-preview");
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.deal.purpose).toBe("purchase");
    expect(body.programContext).toBeUndefined();
    await user.click(screen.getByTestId("ts-flow-refinance"));
    expect(screen.getByTestId("ts-refi-seasoned-scenario")).not.toBeChecked();
  });

  it("keeps older saved refinance inputs generic", () => {
    const oldFields = { ...DEFAULT_DEAL_FORM_FIELDS, payoffAmount: "700000", rehabBudget: "200000", experienceTier: "1", arv: "1400000" };
    delete oldFields.refinanceScenario;
    sessionStorage.setItem(DEAL_FORM_SESSION_STORAGE_KEY, JSON.stringify({ flow: "refinance", fields: oldFields }));
    render(<TermSheetGeneratorClient />);
    expect(screen.getByTestId("ts-refi-seasoned-scenario")).not.toBeChecked();
    expect(screen.getByTestId("ts-refi-payoff")).toHaveValue("700000");
  });

  it("sends refinance rehab and shows the actual financed split without changing the payoff balance", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url, options) => {
      const response = await runDealAnalyze(JSON.parse(options.body));
      return new Response(JSON.stringify(response), { status: 200 });
    }));
    const user = userEvent.setup();
    render(<TermSheetGeneratorClient />);
    const form = screen.getByTestId("ts-form");
    await user.click(screen.getByTestId("ts-flow-refinance"));
    await user.type(within(form).getByTestId("ts-refi-payoff"), "978500");
    await user.type(within(form).getByTestId("ts-refi-requested"), "1027500");
    await user.type(within(form).getByTestId("ts-refi-rehab"), "150000");
    await user.type(within(form).getByTestId("ts-refi-asis"), "1400000");
    await user.type(within(form).getByRole("textbox", { name: /Note rate/ }), "10");
    await user.click(screen.getByTestId("ts-generate-button"));
    const preview = await screen.findByTestId("ts-preview");
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.deal).toMatchObject({
      payoffAmount: 978_500,
      requestedLoanAmount: 1_027_500,
      rehabBudget: 150_000,
    });
    expect(body.assumptions.borrowingRehabFunds).toBe(true);
    expect(preview).toHaveTextContent(/Payoff amount\s*\$978,500/);
    expect(preview).toHaveTextContent(/Acquisition funds\s*\$877,500/);
    expect(preview).toHaveTextContent(/Rehab loan\s*\$150,000/);
    expect(preview).toHaveTextContent(/Total loan\s*\$1,027,500/);
    expect(preview).toHaveTextContent(/Payoff shortfall\s*\$101,000/);
    await waitFor(() => {
      const saved = JSON.parse(sessionStorage.getItem(DEAL_FORM_SESSION_STORAGE_KEY)!);
      expect(saved?.fields.rehabBudget).toBe("150000");
    });
  });

  it("rejects an invalid refinance rehab amount instead of silently using zero", async () => {
    const user = userEvent.setup();
    render(<TermSheetGeneratorClient />);
    const form = screen.getByTestId("ts-form");
    await user.click(screen.getByTestId("ts-flow-refinance"));
    await user.type(within(form).getByTestId("ts-refi-payoff"), "978500");
    await user.type(within(form).getByTestId("ts-refi-rehab"), "-150000");
    await user.click(screen.getByTestId("ts-generate-button"));
    expect(screen.getByText("Rehab budget must be a non-negative number.")).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
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
    expect(
      within(screen.getByTestId("ts-error-5xx")).queryByRole("list"),
    ).not.toBeInTheDocument();
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
