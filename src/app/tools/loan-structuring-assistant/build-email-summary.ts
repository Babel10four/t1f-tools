import type { DealAnalyzeRequestV1 } from "@/lib/engines/deal/schemas/canonical-request";
import type { DealAnalyzeResponseV1 } from "@/lib/engines/deal/schemas/canonical-response";
import { formatMoney } from "./display-helpers";
import { computeInitialLtcPercent } from "@/lib/engines/deal/policy/initial-ltc-display";

/**
 * Short plain-text block for pasting into an email from Deal Structuring Copilot results.
 */
export function buildLoanAssistantEmailSummary(
  request: DealAnalyzeRequestV1,
  response: DealAnalyzeResponseV1,
): string {
  const loan = response.loan;
  const pr = response.pricing;
  const lines: string[] = [];
  lines.push("Deal summary (T1F Copilot)");
  lines.push("");
  lines.push(`Product: ${loan.productType}`);
  lines.push(`Total loan: ${formatMoney(loan.amount)}`);
  if (loan.acquisitionLoanAmount !== undefined) {
    lines.push(`Acquisition loan: ${formatMoney(loan.acquisitionLoanAmount)}`);
  }
  if (loan.rehabLoanAmount !== undefined) {
    lines.push(`Rehab loan: ${formatMoney(loan.rehabLoanAmount)}`);
  }
  lines.push(`LTV: ${loan.ltv !== undefined ? `${loan.ltv}%` : "—"}`);
  const initialLtc = computeInitialLtcPercent(request, loan);
  lines.push(`Initial LTC: ${initialLtc !== undefined ? `${initialLtc}%` : "—"}`);
  lines.push(`Note rate: ${pr.noteRatePercent !== null && pr.noteRatePercent !== undefined ? `${pr.noteRatePercent}%` : "—"}`);
  lines.push(`Pricing status: ${pr.status}`);
  lines.push(`Cash to close (est.): ${formatMoney(response.cashToClose.estimatedTotal)}`);
  lines.push("");
  lines.push("—");
  lines.push("Indicative only; not a commitment to lend.");
  return lines.join("\n");
}
