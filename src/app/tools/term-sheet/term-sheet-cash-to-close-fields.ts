import type { DealAnalyzeRequestV1 } from "@/lib/engines/deal/schemas/canonical-request";
import type { DealAnalyzeResponseV1 } from "@/lib/engines/deal/schemas/canonical-response";
import {
  POLICY_CTC_CLOSING_COSTS_PCT,
  POLICY_CTC_LENDER_FEES_PCT,
  POLICY_CTC_POINTS_PCT,
} from "@/lib/engines/deal/policy/constants";
import { formatMoneyWholeDollars } from "../loan-structuring-assistant/display-helpers";

function formatPolicyPctFraction(fraction: number): string {
  return `${Math.round(fraction * 1000) / 10}%`;
}

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

/** Same leg the deal engine uses for borrower equity on purchase CTC. */
export function acquisitionFundsForCtce(
  loan: DealAnalyzeResponseV1["loan"],
): number | undefined {
  if (loan.acquisitionLoanAmount !== undefined) {
    return loan.acquisitionLoanAmount;
  }
  return loan.amount;
}

export function illustrativeCtcFeePercentSummary(): string {
  return `${formatPolicyPctFraction(POLICY_CTC_POINTS_PCT)} points, ${formatPolicyPctFraction(POLICY_CTC_LENDER_FEES_PCT)} lender fees, ${formatPolicyPctFraction(POLICY_CTC_CLOSING_COSTS_PCT)} closing`;
}

/**
 * Inputs behind the illustrative cash-to-close model (mirrors `analyze.ts` + policy constants).
 */
export function buildTermSheetCtcInputRows(
  request: DealAnalyzeRequestV1 | undefined,
  response: DealAnalyzeResponseV1,
): { label: string; value: string }[] {
  const loan = response.loan;
  const cashToClose = response.cashToClose;
  const feeLine = illustrativeCtcFeePercentSummary();
  const rows: { label: string; value: string }[] = [
    {
      label: "Cash-to-close model status",
      value: cashToClose.status.replace(/_/g, " "),
    },
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
      label:
        "Acquisition funds (for borrower equity; matches engine structuring)",
      value: acq !== undefined ? formatMoneyWholeDollars(acq) : "—",
    });
    rows.push({
      label: "Illustrative fees as % of purchase price",
      value: feeLine,
    });
    if (price !== undefined) {
      rows.push({
        label: "Fee percentages apply to",
        value: formatMoneyWholeDollars(price),
      });
    }
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
      label: "Recommended total loan (CTC reference in engine)",
      value: ref !== undefined ? formatMoneyWholeDollars(ref) : "—",
    });
    rows.push({
      label: "Illustrative fees as % of loan reference",
      value: feeLine,
    });
  }

  return rows;
}
