import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { LoanStructuringAssistantClient } from "./loan-structuring-assistant-client";

afterEach(() => {
  cleanup();
});

const minimalSuccess = {
  schemaVersion: "deal_analyze.v1",
  analysis: { status: "complete" as const, flags: [] },
  loan: {
    purpose: "purchase" as const,
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
    items: [{ label: "Line", amount: 1000 }],
  },
  risks: [],
};

describe("LoanStructuringAssistantClient", () => {
  beforeEach(() => {
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
  });

  it("purchase happy path posts JSON and shows summary", async () => {
    const user = userEvent.setup();
    render(<LoanStructuringAssistantClient />);
    const form = screen.getByTestId("loan-assistant-form");
    await user.type(within(form).getByTestId("purchase-price"), "100000");
    await user.type(within(form).getByTestId("purchase-arv"), "200000");
    await user.click(screen.getByTestId("analyze-button"));
    await waitFor(() => {
      expect(screen.getByTestId("summary-strip")).toBeInTheDocument();
    });
    expect(screen.getByTestId("cash-to-close-panel")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      "/api/deal/analyze",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.deal.purpose).toBe("purchase");
    expect(body.deal.productType).toBe("bridge_purchase");
  });

  it("refinance happy path uses bridge_refinance", async () => {
    const user = userEvent.setup();
    render(<LoanStructuringAssistantClient />);
    const form = screen.getByTestId("loan-assistant-form");
    await user.click(screen.getByTestId("flow-refinance"));
    await user.type(within(form).getByTestId("refi-payoff"), "300000");
    await user.type(within(form).getByTestId("refi-asis"), "500000");
    await user.click(screen.getByTestId("analyze-button"));
    await waitFor(() => {
      expect(screen.getByTestId("summary-strip")).toBeInTheDocument();
    });
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.deal.purpose).toBe("refinance");
    expect(body.deal.productType).toBe("bridge_refinance");
  });

  it("renders 4xx error panel with code and issues", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              error: "Bad request",
              code: "MISSING_REFI_AMOUNT",
              issues: [{ path: "deal.payoffAmount", message: "Required." }],
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          ),
        ),
      ),
    );
    const user = userEvent.setup();
    render(<LoanStructuringAssistantClient />);
    await user.click(screen.getByTestId("flow-refinance"));
    const form = screen.getByTestId("loan-assistant-form");
    await user.type(within(form).getByTestId("refi-payoff"), "300000");
    await user.type(within(form).getByTestId("refi-asis"), "500000");
    await user.click(screen.getByTestId("analyze-button"));
    await waitFor(() => {
      expect(screen.getByTestId("error-panel")).toBeInTheDocument();
    });
    expect(screen.getByText("Bad request")).toBeInTheDocument();
    expect(screen.getByText(/MISSING_REFI_AMOUNT/)).toBeInTheDocument();
    expect(screen.getByText(/deal.payoffAmount/)).toBeInTheDocument();
  });

  it("disables analyze during submit and prevents duplicate requests", async () => {
    let resolveJson!: (v: Response) => void;
    const p = new Promise<Response>((r) => {
      resolveJson = r;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => p),
    );
    const user = userEvent.setup();
    render(<LoanStructuringAssistantClient />);
    const form = screen.getByTestId("loan-assistant-form");
    await user.type(within(form).getByTestId("purchase-price"), "100000");
    await user.type(within(form).getByTestId("purchase-arv"), "200000");
    const btn = screen.getByTestId("analyze-button");
    void user.click(btn);
    await waitFor(() => {
      expect(btn).toBeDisabled();
    });
    expect(screen.getAllByText(/Analyzing/i)[0]).toBeInTheDocument();
    await user.click(btn);
    expect(fetch).toHaveBeenCalledTimes(1);
    resolveJson(
      new Response(JSON.stringify(minimalSuccess), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await waitFor(() => {
      expect(btn).not.toBeDisabled();
    });
  });

  it("edit then re-run calls fetch twice", async () => {
    const user = userEvent.setup();
    render(<LoanStructuringAssistantClient />);
    const form = screen.getByTestId("loan-assistant-form");
    await user.type(within(form).getByTestId("purchase-price"), "100000");
    await user.type(within(form).getByTestId("purchase-arv"), "200000");
    await user.click(screen.getByTestId("analyze-button"));
    await waitFor(() => {
      expect(screen.getByTestId("summary-strip")).toBeInTheDocument();
    });
    await user.clear(within(form).getByTestId("purchase-price"));
    await user.type(within(form).getByTestId("purchase-price"), "120000");
    await user.click(screen.getByTestId("analyze-button"));
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });
});

describe("deal-analyzer harness", () => {
  it("still exports the JSON harness page", async () => {
    const mod = await import("@/app/tools/deal-analyzer/page");
    expect(mod.default).toBeTypeOf("function");
  });
});
