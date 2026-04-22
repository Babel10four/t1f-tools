import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { PricingCalculatorClient } from "./pricing-calculator-client";

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

afterEach(() => {
  cleanup();
});

describe("PricingCalculatorClient", () => {
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

  it("purchase happy path posts JSON and shows pricing summary first", async () => {
    const user = userEvent.setup();
    render(<PricingCalculatorClient />);
    const form = screen.getByTestId("pricing-calculator-form");
    await user.type(within(form).getByTestId("pc-purchase-price"), "100000");
    await user.type(within(form).getByTestId("pc-purchase-arv"), "200000");
    await user.click(screen.getByTestId("pc-analyze-button"));
    await waitFor(() => {
      expect(screen.getByTestId("pricing-summary-strip")).toBeInTheDocument();
    });
    const results = screen.getByTestId("pricing-results");
    expect(results.children[0]).toHaveAttribute("data-testid", "pricing-summary-strip");
    expect(screen.getByTestId("pricing-status-value")).toHaveTextContent("complete");
    expect(screen.getByTestId("pricing-field-note-rate")).toBeInTheDocument();
    expect(screen.getByTestId("pricing-null-scalars-note")).toBeInTheDocument();
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.deal.purpose).toBe("purchase");
    expect(body.deal.productType).toBe("bridge_purchase");
  });

  it("refinance happy path uses bridge_refinance", async () => {
    const user = userEvent.setup();
    render(<PricingCalculatorClient />);
    const form = screen.getByTestId("pricing-calculator-form");
    await user.click(screen.getByTestId("pc-flow-refinance"));
    await user.type(within(form).getByTestId("pc-refi-payoff"), "300000");
    await user.type(within(form).getByTestId("pc-refi-asis"), "500000");
    await user.click(screen.getByTestId("pc-analyze-button"));
    await waitFor(() => {
      expect(screen.getByTestId("pricing-summary-strip")).toBeInTheDocument();
    });
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.deal.purpose).toBe("refinance");
    expect(body.deal.productType).toBe("bridge_refinance");
  });

  it("renders 4xx panel with code and issues", async () => {
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
    render(<PricingCalculatorClient />);
    const form = screen.getByTestId("pricing-calculator-form");
    await user.click(screen.getByTestId("pc-flow-refinance"));
    await user.type(within(form).getByTestId("pc-refi-payoff"), "300000");
    await user.type(within(form).getByTestId("pc-refi-asis"), "500000");
    await user.click(screen.getByTestId("pc-analyze-button"));
    await waitFor(() => {
      expect(screen.getByTestId("pc-error-panel")).toBeInTheDocument();
    });
    expect(screen.getByText("Bad request")).toBeInTheDocument();
  });

  it("disables analyze during submit and prevents duplicate requests", async () => {
    let resolveJson!: (v: Response) => void;
    const p = new Promise<Response>((r) => {
      resolveJson = r;
    });
    vi.stubGlobal("fetch", vi.fn(() => p));
    const user = userEvent.setup();
    render(<PricingCalculatorClient />);
    const form = screen.getByTestId("pricing-calculator-form");
    await user.type(within(form).getByTestId("pc-purchase-price"), "100000");
    await user.type(within(form).getByTestId("pc-purchase-arv"), "200000");
    const btn = screen.getByTestId("pc-analyze-button");
    void user.click(btn);
    await waitFor(() => {
      expect(btn).toBeDisabled();
    });
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
    render(<PricingCalculatorClient />);
    const form = screen.getByTestId("pricing-calculator-form");
    await user.type(within(form).getByTestId("pc-purchase-price"), "100000");
    await user.type(within(form).getByTestId("pc-purchase-arv"), "200000");
    await user.click(screen.getByTestId("pc-analyze-button"));
    await waitFor(() => {
      expect(screen.getByTestId("pricing-summary-strip")).toBeInTheDocument();
    });
    await user.clear(within(form).getByTestId("pc-purchase-price"));
    await user.type(within(form).getByTestId("pc-purchase-price"), "120000");
    await user.click(screen.getByTestId("pc-analyze-button"));
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  it("renders note rate and margin (bridge pricing UI omits discount points and lock days)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              ...minimalSuccess,
              pricing: {
                status: "indicative",
                noteRatePercent: 6,
                marginBps: 100,
                discountPoints: 0,
                lockDays: 45,
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        ),
      ),
    );
    const user = userEvent.setup();
    render(<PricingCalculatorClient />);
    const form = screen.getByTestId("pricing-calculator-form");
    await user.type(within(form).getByTestId("pc-purchase-price"), "100000");
    await user.type(within(form).getByTestId("pc-purchase-arv"), "200000");
    await user.click(screen.getByTestId("pc-analyze-button"));
    await waitFor(() => {
      expect(screen.getByTestId("pricing-field-note-rate")).toHaveTextContent("6%");
    });
    expect(screen.getByTestId("pricing-field-margin-bps")).toHaveTextContent("100 bps");
    expect(screen.queryByTestId("pricing-field-lock-days")).toBeNull();
    expect(screen.queryByTestId("pricing-null-scalars-note")).not.toBeInTheDocument();
    expect(screen.queryByText(/APR/i)).toBeNull();
  });
});

describe("TICKET-004 harness smoke", () => {
  it("deal-analyzer JSON harness still exports", async () => {
    const mod = await import("@/app/tools/deal-analyzer/page");
    expect(mod.default).toBeTypeOf("function");
  });

  it("loan-structuring-assistant still exports", async () => {
    const mod = await import("@/app/tools/loan-structuring-assistant/page");
    expect(mod.default).toBeTypeOf("function");
  });
});
