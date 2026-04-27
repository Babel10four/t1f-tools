import type { DealAnalyzeRequestV1 } from "@/lib/engines/deal/schemas/canonical-request";
import type { DealAnalyzeResponseV1 } from "@/lib/engines/deal/schemas/canonical-response";
import { formatMoneyWholeDollars } from "../loan-structuring-assistant/display-helpers";
import { formatNoteRatePercentDisplay } from "../pricing-calculator/pricing-display";
import type { TermSheetLocalMetadata } from "./term-sheet-types";

function purposeLabel(p: string): string {
  switch (p) {
    case "purchase":
      return "Purchase";
    case "refinance":
      return "Refinance";
    default:
      return p;
  }
}

/**
 * Plain-text term sheet for email / clipboard (matches on-screen preview fields).
 */
export function buildTermSheetPlainText(
  metadata: TermSheetLocalMetadata,
  request: DealAnalyzeRequestV1 | undefined,
  response: DealAnalyzeResponseV1,
): string {
  const loan = response.loan;
  const lines: string[] = [];
  lines.push("Tier One Funding Inc");
  lines.push("Term Sheet");
  lines.push("");
  lines.push(`Property: ${metadata.propertyLabel.trim() || "—"}`);
  lines.push(`Prepared: ${metadata.preparedDate.trim() || "—"}`);
  if (metadata.preparedBy.trim() !== "") {
    lines.push(`Prepared by: ${metadata.preparedBy.trim()}`);
  }
  lines.push("");
  lines.push("INPUTS");
  lines.push(`Transaction type: ${purposeLabel(loan.purpose)}`);
  lines.push(
    `Tier: ${request?.borrower?.experienceTier?.trim() ? request.borrower.experienceTier : "—"}`,
  );
  if (request?.deal.purchasePrice !== undefined) {
    lines.push(`Purchase price: ${formatMoneyWholeDollars(request.deal.purchasePrice)}`);
  }
  if (request?.deal.payoffAmount !== undefined) {
    lines.push(`Payoff amount: ${formatMoneyWholeDollars(request.deal.payoffAmount)}`);
  }
  lines.push(
    `Rehab amount: ${formatMoneyWholeDollars(request?.deal.rehabBudget ?? loan.rehabBudget)}`,
  );
  if (request?.property?.arv !== undefined) {
    lines.push(`ARV: ${formatMoneyWholeDollars(request.property.arv)}`);
  }
  if (loan.originationPointsPercent !== undefined) {
    lines.push(
      `Lender points: ${formatNoteRatePercentDisplay(loan.originationPointsPercent)}`,
    );
  }
  lines.push(
    `Rate: ${formatNoteRatePercentDisplay(response.pricing.noteRatePercent)}`,
  );
  lines.push(
    `Term: ${loan.termMonths === null || loan.termMonths === undefined ? "—" : `${loan.termMonths} months`}`,
  );
  if (loan.originationFlatFee !== undefined) {
    lines.push(
      `Lender loan fee: ${formatMoneyWholeDollars(loan.originationFlatFee)}`,
    );
  }
  lines.push("");
  lines.push("TERMS OFFERED");
  if (loan.acquisitionLoanAmount !== undefined) {
    lines.push(`Initial / acquisition loan: ${formatMoneyWholeDollars(loan.acquisitionLoanAmount)}`);
  }
  if (loan.rehabLoanAmount !== undefined) {
    lines.push(`Rehab loan: ${formatMoneyWholeDollars(loan.rehabLoanAmount)}`);
  }
  lines.push(`Total loan: ${formatMoneyWholeDollars(loan.amount)}`);
  lines.push(`LTV: ${loan.ltv !== undefined ? `${loan.ltv}%` : "—"}`);
  lines.push(`LTC: ${loan.ltcPercent !== undefined ? `${loan.ltcPercent}%` : "—"}`);
  lines.push("");
  lines.push(
    "This term sheet is for discussion purposes only and does not constitute a commitment to lend.",
  );
  lines.push(
    "All terms are subject to underwriting, appraisal/valuation, and final approval.",
  );
  return lines.join("\n");
}
