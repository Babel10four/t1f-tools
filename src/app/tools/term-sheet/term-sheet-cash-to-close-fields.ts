import type { DealAnalyzeRequestV1 } from "@/lib/engines/deal/schemas/canonical-request";
import type { DealAnalyzeResponseV1 } from "@/lib/engines/deal/schemas/canonical-response";
import { buildCashToCloseLoanCostSummary } from "../cash-to-close-estimator/cash-to-close-estimator-display";
import { formatMoneyWholeDollars } from "../loan-structuring-assistant/display-helpers";

export function purposeLabelForCtc(p: string): string {
  switch (p) {
    case "purchase":
      return "Purchase";
    case "refinance":
      return "Refinance";
    default:
      return p;
  }
}

/** Customer-facing lead-in under the cash estimate (PDF, preview, plain text). */
export const TERM_SHEET_CTC_THIRD_PARTY_ASSUMPTIONS =
  "Title, escrow settlement, hazard insurance, and similar third-party costs are not included in this cash-to-close estimate; your providers will set final amounts at closing.";

/** Same leg the deal engine uses for borrower equity on purchase CTC. */
export function acquisitionFundsForCtce(
  loan: DealAnalyzeResponseV1["loan"],
): number | undefined {
  if (loan.acquisitionLoanAmount !== undefined) {
    return loan.acquisitionLoanAmount;
  }
  return loan.amount;
}

/**
 * Cash-to-close model inputs shown on term sheet exports.
 */
export function buildTermSheetCtcInputRows(
  request: DealAnalyzeRequestV1 | undefined,
  response: DealAnalyzeResponseV1,
): { label: string; value: string }[] {
  const loan = response.loan;
  const rows: { label: string; value: string }[] = [
    { label: "Transaction type", value: purposeLabelForCtc(loan.purpose) },
  ];

  if (loan.purpose === "purchase") {
    const price = request?.deal.purchasePrice;
    rows.push({
      label: "Purchase price (reference)",
      value: price !== undefined ? formatMoneyWholeDollars(price) : "—",
    });
    const acq = acquisitionFundsForCtce(loan);
    rows.push({
      label: "Acquisition funds (applied to borrower equity)",
      value: acq !== undefined ? formatMoneyWholeDollars(acq) : "—",
    });
  } else {
    rows.push({
      label: "Payoff / basis (entered)",
      value:
        request?.deal.payoffAmount !== undefined
          ? formatMoneyWholeDollars(request.deal.payoffAmount)
          : "—",
    });
    const ref = loan.amount;
    rows.push({
      label: "Total loan amount (basis for estimate)",
      value: ref !== undefined ? formatMoneyWholeDollars(ref) : "—",
    });
  }

  return rows;
}

export function buildTermSheetCtcEstimateRows(
  response: DealAnalyzeResponseV1,
): { label: string; value: string }[] {
  const flow = response.loan.purpose === "refinance" ? "refinance" : "purchase";
  const summary = buildCashToCloseLoanCostSummary({ flow, response });
  const rows: { label: string; value: string }[] = [
    { label: summary.basisLabel, value: formatMoneyWholeDollars(summary.basisAmount) },
    { label: "Loan fees", value: formatMoneyWholeDollars(summary.loanFees) },
    { label: "Interest costs", value: formatMoneyWholeDollars(summary.interestCosts) },
    {
      label: "Estimated cash to close (excludes title/insurance)",
      value: formatMoneyWholeDollars(summary.estimatedLoanCostsExcludingTitleInsurance),
    },
  ];
  if (
    summary.perDiem !== null &&
    summary.remainingDaysInMonth !== null &&
    summary.firstFullMonthInterest !== null
  ) {
    rows.push({
      label: "Interest calc detail",
      value: `${formatMoneyWholeDollars(summary.perDiem)} per diem × ${summary.remainingDaysInMonth} days + ${formatMoneyWholeDollars(summary.firstFullMonthInterest)} first full month`,
    });
  }
  return rows;
}
