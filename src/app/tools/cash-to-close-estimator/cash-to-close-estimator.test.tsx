import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CashToCloseEstimatorClient } from "./cash-to-close-estimator-client";

afterEach(() => {
  cleanup();
});

function baseResponse(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: "deal_analyze.v1",
    analysis: {
      status: "complete" as const,
      flags: [{ code: "FLAG_A", severity: "info" as const, message: "Server flag message" }],
    },
    loan: {
      purpose: "purchase" as const,
      productType: "bridge_purchase",
      termMonths: null as number | null,
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
      estimatedTotal: 5000,
      items: [
        { label: "Borrower equity", amount: 2000 },
        { label: "Estimated points", amount: 3000 },
      ],
    },
    risks: [
      {
        code: "R1",
        severity: "medium" as const,
        title: "Risk title",
        detail: "Risk detail from server.",
      },
    ],
    ...overrides,
  };
}

describe("CashToCloseEstimatorClient", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify(baseResponse()), {
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

  it("purchase happy path posts bridge_purchase and shows cash-first results", async () => {
    const user = userEvent.setup();
    render(<CashToCloseEstimatorClient />);
    const form = screen.getByTestId("ctc-form");
    await user.type(within(form).getByTestId("ctc-purchase-price"), "100000");
    await user.type(within(form).getByTestId("ctc-purchase-arv"), "200000");
    await user.click(screen.getByTestId("ctc-estimate-button"));
    await waitFor(() => {
      expect(screen.getByTestId("ctc-results")).toBeInTheDocument();
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/deal/analyze",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.deal.purpose).toBe("purchase");
    expect(body.deal.productType).toBe("bridge_purchase");
    expect(screen.getByTestId("ctc-cash-estimated-total")).toHaveTextContent(/\$5,000/);
    expect(screen.getByTestId("ctc-cash-status")).toHaveTextContent("complete");
  });

  it("refinance happy path uses bridge_refinance", async () => {
    const user = userEvent.setup();
    render(<CashToCloseEstimatorClient />);
    const form = screen.getByTestId("ctc-form");
    await user.click(screen.getByTestId("ctc-flow-refinance"));
    await user.type(within(form).getByTestId("ctc-refi-payoff"), "300000");
    await user.type(within(form).getByTestId("ctc-refi-asis"), "500000");
    await user.click(screen.getByTestId("ctc-estimate-button"));
    await waitFor(() => {
      expect(screen.getByTestId("ctc-results")).toBeInTheDocument();
    });
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.deal.purpose).toBe("refinance");
    expect(body.deal.productType).toBe("bridge_refinance");
  });

  it("shows estimatedTotal when present", async () => {
    const user = userEvent.setup();
    render(<CashToCloseEstimatorClient />);
    const form = screen.getByTestId("ctc-form");
    await user.type(within(form).getByTestId("ctc-purchase-price"), "100000");
    await user.type(within(form).getByTestId("ctc-purchase-arv"), "200000");
    await user.click(screen.getByTestId("ctc-estimate-button"));
    await waitFor(() => {
      expect(screen.getByTestId("ctc-cash-estimated-total")).not.toHaveTextContent("Not returned");
    });
  });

  it("estimatedTotal null with non-empty items shows Not returned and still lists lines", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify(
              baseResponse({
                cashToClose: {
                  status: "indicative",
                  estimatedTotal: null,
                  items: [{ label: "Only line", amount: 100 }],
                },
              }),
            ),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        ),
      ),
    );
    const user = userEvent.setup();
    render(<CashToCloseEstimatorClient />);
    const form = screen.getByTestId("ctc-form");
    await user.type(within(form).getByTestId("ctc-purchase-price"), "100000");
    await user.type(within(form).getByTestId("ctc-purchase-arv"), "200000");
    await user.click(screen.getByTestId("ctc-estimate-button"));
    await waitFor(() => {
      expect(screen.getByTestId("ctc-cash-estimated-total")).toHaveTextContent("Not returned");
    });
    expect(screen.getByText("Only line")).toBeInTheDocument();
  });

  it("empty items shows message and no list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify(
              baseResponse({
                cashToClose: {
                  status: "stub",
                  estimatedTotal: null,
                  items: [],
                },
              }),
            ),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        ),
      ),
    );
    const user = userEvent.setup();
    render(<CashToCloseEstimatorClient />);
    const form = screen.getByTestId("ctc-form");
    await user.type(within(form).getByTestId("ctc-purchase-price"), "100000");
    await user.type(within(form).getByTestId("ctc-purchase-arv"), "200000");
    await user.click(screen.getByTestId("ctc-estimate-button"));
    await waitFor(() => {
      expect(screen.getByText("No line items were returned.")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("ctc-cash-lines-list")).not.toBeInTheDocument();
  });

  it("renders 4xx with error, code, and issues", async () => {
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
    render(<CashToCloseEstimatorClient />);
    await user.click(screen.getByTestId("ctc-flow-refinance"));
    const form = screen.getByTestId("ctc-form");
    await user.type(within(form).getByTestId("ctc-refi-payoff"), "300000");
    await user.type(within(form).getByTestId("ctc-refi-asis"), "500000");
    await user.click(screen.getByTestId("ctc-estimate-button"));
    await waitFor(() => {
      expect(screen.getByTestId("ctc-error-4xx")).toBeInTheDocument();
    });
    expect(screen.getByText("Bad request")).toBeInTheDocument();
    expect(screen.getByText(/MISSING_REFI_AMOUNT/)).toBeInTheDocument();
    expect(screen.getByText(/deal.payoffAmount/)).toBeInTheDocument();
  });

  it("5xx shows generic error without fabricated issues", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(new Response("{}", { status: 500, headers: { "Content-Type": "application/json" } })),
      ),
    );
    const user = userEvent.setup();
    render(<CashToCloseEstimatorClient />);
    const form = screen.getByTestId("ctc-form");
    await user.type(within(form).getByTestId("ctc-purchase-price"), "100000");
    await user.type(within(form).getByTestId("ctc-purchase-arv"), "200000");
    await user.click(screen.getByTestId("ctc-estimate-button"));
    await waitFor(() => {
      expect(screen.getByTestId("ctc-error-5xx")).toBeInTheDocument();
    });
    expect(within(screen.getByTestId("ctc-error-5xx")).queryByRole("list")).not
      .toBeInTheDocument();
  });

  it("disables button during submit and prevents double fetch", async () => {
    let resolveJson!: (v: Response) => void;
    const p = new Promise<Response>((r) => {
      resolveJson = r;
    });
    vi.stubGlobal("fetch", vi.fn(() => p));
    const user = userEvent.setup();
    render(<CashToCloseEstimatorClient />);
    const form = screen.getByTestId("ctc-form");
    await user.type(within(form).getByTestId("ctc-purchase-price"), "100000");
    await user.type(within(form).getByTestId("ctc-purchase-arv"), "200000");
    const btn = screen.getByTestId("ctc-estimate-button");
    void user.click(btn);
    await waitFor(() => {
      expect(btn).toBeDisabled();
    });
    expect(screen.getByTestId("ctc-submitting")).toBeInTheDocument();
    await user.click(btn);
    expect(fetch).toHaveBeenCalledTimes(1);
    resolveJson(
      new Response(JSON.stringify(baseResponse()), {
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
    render(<CashToCloseEstimatorClient />);
    const form = screen.getByTestId("ctc-form");
    await user.type(within(form).getByTestId("ctc-purchase-price"), "100000");
    await user.type(within(form).getByTestId("ctc-purchase-arv"), "200000");
    await user.click(screen.getByTestId("ctc-estimate-button"));
    await waitFor(() => {
      expect(screen.getByTestId("ctc-results")).toBeInTheDocument();
    });
    await user.clear(within(form).getByTestId("ctc-purchase-price"));
    await user.type(within(form).getByTestId("ctc-purchase-price"), "120000");
    await user.click(screen.getByTestId("ctc-estimate-button"));
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  it("output sections appear in cash-first order", async () => {
    const user = userEvent.setup();
    render(<CashToCloseEstimatorClient />);
    const form = screen.getByTestId("ctc-form");
    await user.type(within(form).getByTestId("ctc-purchase-price"), "100000");
    await user.type(within(form).getByTestId("ctc-purchase-arv"), "200000");
    await user.click(screen.getByTestId("ctc-estimate-button"));
    await waitFor(() => {
      expect(screen.getByTestId("ctc-results")).toBeInTheDocument();
    });
    const root = screen.getByTestId("ctc-results");
    const sections = root.querySelectorAll("section");
    expect(sections[0]?.getAttribute("data-testid")).toBe("ctc-cash-summary-strip");
    expect(sections[1]?.getAttribute("data-testid")).toBe("ctc-cash-line-items");
    expect(sections[2]?.getAttribute("data-testid")).toBe("ctc-analysis-context");
    expect(sections[3]?.getAttribute("data-testid")).toBe("ctc-risks-panel");
    expect(sections[4]?.getAttribute("data-testid")).toBe("ctc-secondary-context");
  });

  it("preserves exact server line order and labels", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify(
              baseResponse({
                cashToClose: {
                  status: "complete",
                  estimatedTotal: 3,
                  items: [
                    { label: "Zeta first", amount: 1 },
                    { label: "Alpha second", amount: 2 },
                  ],
                },
              }),
            ),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        ),
      ),
    );
    const user = userEvent.setup();
    render(<CashToCloseEstimatorClient />);
    const form = screen.getByTestId("ctc-form");
    await user.type(within(form).getByTestId("ctc-purchase-price"), "100000");
    await user.type(within(form).getByTestId("ctc-purchase-arv"), "200000");
    await user.click(screen.getByTestId("ctc-estimate-button"));
    await waitFor(() => {
      expect(screen.getByTestId("ctc-cash-lines-list")).toBeInTheDocument();
    });
    const list = screen.getByTestId("ctc-cash-lines-list");
    const rows = list.querySelectorAll("li");
    expect(within(rows[0] as HTMLElement).getByText("Zeta first")).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText("Alpha second")).toBeInTheDocument();
  });

  it("preserves analysis flag order from server", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify(
              baseResponse({
                analysis: {
                  status: "incomplete",
                  flags: [
                    { code: "SECOND", severity: "low" as const, message: "Second" },
                    { code: "FIRST", severity: "info" as const, message: "First" },
                  ],
                },
              }),
            ),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        ),
      ),
    );
    const user = userEvent.setup();
    render(<CashToCloseEstimatorClient />);
    const form = screen.getByTestId("ctc-form");
    await user.type(within(form).getByTestId("ctc-purchase-price"), "100000");
    await user.type(within(form).getByTestId("ctc-purchase-arv"), "200000");
    await user.click(screen.getByTestId("ctc-estimate-button"));
    await waitFor(() => {
      expect(screen.getByTestId("ctc-analysis-context")).toBeInTheDocument();
    });
    const panel = screen.getByTestId("ctc-analysis-context");
    const lis = panel.querySelectorAll("ul li");
    expect(lis[0]?.textContent).toContain("SECOND");
    expect(lis[1]?.textContent).toContain("FIRST");
  });
});

describe("sibling tools unchanged", () => {
  it("deal-analyzer harness page still exports", async () => {
    const mod = await import("@/app/tools/deal-analyzer/page");
    expect(mod.default).toBeTypeOf("function");
  });

  it("loan-structuring-assistant page still exports", async () => {
    const mod = await import("@/app/tools/loan-structuring-assistant/page");
    expect(mod.default).toBeTypeOf("function");
  });

  it("pricing-calculator page still exports", async () => {
    const mod = await import("@/app/tools/pricing-calculator/page");
    expect(mod.default).toBeTypeOf("function");
  });
});
