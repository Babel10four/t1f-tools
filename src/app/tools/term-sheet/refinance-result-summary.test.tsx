import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { runDealAnalyze } from "@/lib/engines/deal/analyze";
import type { DealAnalyzeRequestV1 } from "@/lib/engines/deal/schemas/canonical-request";
import { buildTermSheetCtcEstimateRows } from "./term-sheet-cash-to-close-fields";
import { RefinanceResultSummary } from "./refinance-result-summary";

afterEach(cleanup);

const request: DealAnalyzeRequestV1 = {
  schemaVersion: "deal_analyze.v1",
  deal: { purpose: "refinance", productType: "bridge_refinance", payoffAmount: 563_700, requestedLoanAmount: 560_000, rehabBudget: 0, termMonths: 12 },
  property: { asIsValue: 800_000 },
  assumptions: { noteRatePercent: 9.25, originationFlatFee: 2_000, borrowingRehabFunds: false },
};
const asOfDate = new Date(2026, 10, 30);

describe("Refinance funding summary", () => {
  it("uses the same closing-date estimate as the exported breakdown and provides an edit link", async () => {
    const response = await runDealAnalyze(request);
    const exported = buildTermSheetCtcEstimateRows(response, asOfDate);
    render(<><details id="refi-pricing" tabIndex={-1}><summary>Pricing and fees</summary></details>
      <RefinanceResultSummary response={response} asOfDate={asOfDate} /></>);

    const total = exported.find((row) => row.label.startsWith("Estimated cash to close"))!;
    expect(screen.getByText(total.value)).toBeInTheDocument();
    expect(screen.getByText(/Payoff shortfall \$3,700 \+ loan fees \$2,000/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Edit pricing and fees" }));
    expect(document.getElementById("refi-pricing")).toHaveAttribute("open");
    expect(document.getElementById("refi-pricing")).toHaveFocus();
  });

  it("distinguishes gross proceeds above payoff from the existing closing-cost estimate", async () => {
    const response = await runDealAnalyze({ ...request, deal: { ...request.deal, payoffAmount: 545_000 } });
    render(<RefinanceResultSummary response={response} asOfDate={asOfDate} />);
    expect(screen.getByRole("heading")).toHaveTextContent("Estimated closing costs before applying excess proceeds");
    expect(screen.getByLabelText("Refinance funding summary")).toHaveTextContent("Initial funds exceed the existing payoff by $15,000 before fees and interest.");
  });

  it("shows the policy sizing issue and withholds any numerical estimate for an unfundable rehab request", async () => {
    const response = await runDealAnalyze({ ...request, deal: { ...request.deal, rehabBudget: 600_000 }, assumptions: { ...request.assumptions, borrowingRehabFunds: true } });
    render(<RefinanceResultSummary response={response} asOfDate={asOfDate} />);
    expect(screen.getByText("Estimate unavailable")).toBeInTheDocument();
    expect(screen.getByLabelText("Sizing details")).toHaveTextContent("Full refinance rehab holdback cannot be funded");
    expect(screen.queryByText("$0")).not.toBeInTheDocument();
  });
});
