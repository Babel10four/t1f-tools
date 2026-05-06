import type { DealAnalyzeRequestV1 } from "@/lib/engines/deal/schemas/canonical-request";
import type { DealAnalyzeResponseV1 } from "@/lib/engines/deal/schemas/canonical-response";
import { TERM_SHEET_DISCLAIMER_DETAILS } from "@/lib/tools/disclaimer-copy";
import { formatMoneyWholeDollars } from "../loan-structuring-assistant/display-helpers";
import { formatNoteRatePercentDisplay } from "../pricing-calculator/pricing-display";
import type { TermSheetLocalMetadata } from "./term-sheet-types";
import { transformCashToCloseDisplayLines } from "../cash-to-close-estimator/cash-to-close-estimator-display";
import {
  buildTermSheetCtcInputRows,
  TERM_SHEET_CTC_THIRD_PARTY_ASSUMPTIONS,
} from "./term-sheet-cash-to-close-fields";

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
    lines.push(`Acquisition funds: ${formatMoneyWholeDollars(loan.acquisitionLoanAmount)}`);
  }
  if (loan.rehabLoanAmount !== undefined) {
    lines.push(`Rehab loan: ${formatMoneyWholeDollars(loan.rehabLoanAmount)}`);
  }
  lines.push(`Total loan: ${formatMoneyWholeDollars(loan.amount)}`);
  lines.push(`LTV: ${loan.ltv !== undefined ? `${loan.ltv}%` : "—"}`);
  lines.push(`LTC: ${loan.ltcPercent !== undefined ? `${loan.ltcPercent}%` : "—"}`);
  lines.push("");
  lines.push("CASH TO CLOSE");
  lines.push(
    "Indicative estimate only — not a Closing Disclosure. Assumed title, escrow settlement, hazard insurance, and similar third-party fees are placeholders.",
  );
  lines.push("");
  lines.push("Inputs");
  for (const row of buildTermSheetCtcInputRows(request, response)) {
    lines.push(`${row.label}: ${row.value}`);
  }
  lines.push("");
  lines.push("Estimate");
  lines.push(TERM_SHEET_CTC_THIRD_PARTY_ASSUMPTIONS);
  lines.push("");
  const cashPurpose = loan.purpose === "refinance" ? "refinance" : "purchase";
  const cashDisplay = transformCashToCloseDisplayLines(
    response.cashToClose.items,
    {
      purpose: cashPurpose,
      purchasePrice: request?.deal.purchasePrice,
    },
  );
  if (cashDisplay.length === 0) {
    lines.push(
      "No line-by-line cash to close breakdown is shown — complete deal inputs and regenerate if needed.",
    );
  } else {
    for (const row of cashDisplay) {
      lines.push(`- ${row.label}: ${formatMoneyWholeDollars(row.amount)}`);
      if (row.sublabel) {
        lines.push(`  ${row.sublabel}`);
      }
      if (row.footnote) {
        lines.push(`  ${row.footnote}`);
      }
    }
  }
  lines.push("");
  lines.push(
    response.cashToClose.estimatedTotal === null
      ? "Estimated cash to close (total): not available for this scenario."
      : `Estimated cash to close (total): ${formatMoneyWholeDollars(response.cashToClose.estimatedTotal)}`,
  );
  lines.push("");
  lines.push(...TERM_SHEET_DISCLAIMER_DETAILS);
  return lines.join("\n");
}
