/**
 * Borrower-facing export builders for the Pricing Comparison panel.
 *
 * Pure and side-effect-free. Consumes the {@link PricingComparisonResult} from
 * `@/lib/tools/pricing-comparison` plus a little context the result does not echo (loan duration and
 * each side's rate). Internal-only figures (`T1F revenue`, `Adjusted total interest, points & fees`)
 * are intentionally excluded so output is safe to send to a borrower.
 */

import {
  type LoanStructure,
  type PricingComparisonResult,
  type SidePricingResult,
} from "@/lib/tools/pricing-comparison";
import { PRICING_COMPARISON_DISCLAIMER } from "@/lib/tools/disclaimer-copy";
import { formatMoneyWholeDollars } from "../loan-structuring-assistant/display-helpers";

export type PricingComparisonExportInput = {
  result: PricingComparisonResult;
  loanDurationMonths: number;
  t1fRatePercent: number;
  competitorRatePercent: number;
};

export type ExportRow = { label: string; value: string };

export const T1F_LABEL = "Tier One Funding";
export const COMPETITOR_LABEL = "Competitor";

function structureLabel(structure: LoanStructure): string {
  return structure === "dutch"
    ? "Term (interest on full balance)"
    : "Draw (interest on funds drawn)";
}

/** Trim trailing zeros so 8.500 -> "8.5%" and 0 -> "0%". */
function formatRate(ratePercent: number): string {
  if (!Number.isFinite(ratePercent)) {
    return "—";
  }
  const rounded = Math.round(ratePercent * 1000) / 1000;
  return `${rounded}%`;
}

export function buildPricingComparisonLoanInfoRows(
  input: PricingComparisonExportInput,
): ExportRow[] {
  const rows: ExportRow[] = [];
  if (input.result.purchasePrice > 0) {
    rows.push({
      label: "Purchase price",
      value: formatMoneyWholeDollars(input.result.purchasePrice),
    });
  }
  rows.push({
    label: "Loan duration",
    value: `${input.loanDurationMonths} months`,
  });
  return rows;
}

/** Borrower-facing per-side rows (excludes revenue and adjusted-total internal figures). */
export function buildPricingComparisonSideRows(
  side: SidePricingResult,
  ratePercent: number,
): ExportRow[] {
  const rows: ExportRow[] = [];
  rows.push({ label: "Loan type", value: structureLabel(side.structure) });
  rows.push({
    label: "Total loan amount",
    value: formatMoneyWholeDollars(side.totalLoanAmount),
  });
  if (side.borrowerDownPayment !== null) {
    rows.push({
      label: "Borrower down payment",
      value: formatMoneyWholeDollars(side.borrowerDownPayment),
    });
  }
  rows.push({ label: "Rate", value: formatRate(ratePercent) });
  rows.push({ label: "Interest", value: formatMoneyWholeDollars(side.interest) });
  rows.push({
    label: "Origination points",
    value: formatMoneyWholeDollars(side.originationPointsDollars),
  });
  rows.push({
    label: "Admin fees",
    value: formatMoneyWholeDollars(side.adminFees),
  });
  rows.push({
    label: "Total interest, points & fees",
    value: formatMoneyWholeDollars(side.totalInterestPointsFees),
  });
  return rows;
}

export function buildPricingComparisonSavingsRows(
  result: PricingComparisonResult,
): ExportRow[] {
  return [
    {
      label: `Total savings with ${T1F_LABEL}`,
      value: formatMoneyWholeDollars(result.pricingGap),
    },
    {
      label: "Upfront savings",
      value: formatMoneyWholeDollars(result.upfrontSavings),
    },
  ];
}

/** Plain-text comparison for clipboard fallback / plain email. */
export function buildPricingComparisonPlainText(
  input: PricingComparisonExportInput,
): string {
  const { result } = input;
  const lines: string[] = [];
  lines.push(T1F_LABEL);
  lines.push("Pricing Comparison");
  lines.push("");
  lines.push("LOAN INFORMATION");
  for (const row of buildPricingComparisonLoanInfoRows(input)) {
    lines.push(`${row.label}: ${row.value}`);
  }
  lines.push("");
  lines.push(T1F_LABEL.toUpperCase());
  for (const row of buildPricingComparisonSideRows(result.t1f, input.t1fRatePercent)) {
    lines.push(`${row.label}: ${row.value}`);
  }
  lines.push("");
  lines.push(COMPETITOR_LABEL.toUpperCase());
  for (const row of buildPricingComparisonSideRows(
    result.competitor,
    input.competitorRatePercent,
  )) {
    lines.push(`${row.label}: ${row.value}`);
  }
  lines.push("");
  lines.push("SAVINGS");
  for (const row of buildPricingComparisonSavingsRows(result)) {
    lines.push(`${row.label}: ${row.value}`);
  }
  lines.push("");
  lines.push(...PRICING_COMPARISON_DISCLAIMER);
  return lines.join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const BRAND_HEX = "#285c2e";

/**
 * Self-contained, inline-styled HTML table. Inline styles (not classes) so it survives a paste into
 * Gmail / Outlook with layout intact.
 */
export function buildPricingComparisonEmailHtml(
  input: PricingComparisonExportInput,
): string {
  const { result } = input;
  const loanInfoRows = buildPricingComparisonLoanInfoRows(input);
  const t1fRows = buildPricingComparisonSideRows(result.t1f, input.t1fRatePercent);
  const compRows = buildPricingComparisonSideRows(
    result.competitor,
    input.competitorRatePercent,
  );
  const savingsRows = buildPricingComparisonSavingsRows(result);

  const cell = "padding:6px 10px;border-bottom:1px solid #e4e4e7;font-size:14px;";
  const labelCell = `${cell}color:#52525b;text-align:left;`;
  const valueCell = `${cell}text-align:right;font-weight:600;color:#18181b;`;
  const headCell =
    "padding:8px 10px;font-size:13px;text-transform:uppercase;letter-spacing:0.04em;text-align:right;color:#ffffff;background:" +
    BRAND_HEX +
    ";";

  const loanInfoHtml = loanInfoRows
    .map(
      (r) =>
        `<tr><td style="${labelCell}">${escapeHtml(r.label)}</td><td style="${valueCell}">${escapeHtml(r.value)}</td></tr>`,
    )
    .join("");

  const comparisonRowsHtml = t1fRows
    .map((r, i) => {
      const comp = compRows[i];
      return `<tr><td style="${labelCell}">${escapeHtml(r.label)}</td><td style="${valueCell}">${escapeHtml(r.value)}</td><td style="${valueCell}">${escapeHtml(comp ? comp.value : "—")}</td></tr>`;
    })
    .join("");

  const savingsHtml = savingsRows
    .map(
      (r) =>
        `<tr><td style="padding:6px 10px;font-size:14px;color:#14532d;text-align:left;">${escapeHtml(r.label)}</td><td style="padding:6px 10px;font-size:16px;font-weight:700;color:#14532d;text-align:right;">${escapeHtml(r.value)}</td></tr>`,
    )
    .join("");

  const disclaimerHtml = PRICING_COMPARISON_DISCLAIMER.map(
    (line) =>
      `<p style="margin:2px 0;font-size:11px;color:#71717a;">${escapeHtml(line)}</p>`,
  ).join("");

  return [
    `<div style="font-family:Arial,Helvetica,sans-serif;color:#18181b;max-width:640px;">`,
    `<p style="margin:0;font-size:13px;color:${BRAND_HEX};font-weight:700;">${T1F_LABEL}</p>`,
    `<h2 style="margin:2px 0 12px;font-size:20px;color:#18181b;">Pricing Comparison</h2>`,
    `<table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;margin-bottom:14px;">${loanInfoHtml}</table>`,
    `<table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;margin-bottom:14px;">`,
    `<tr><td style="padding:8px 10px;font-size:13px;text-transform:uppercase;letter-spacing:0.04em;color:#ffffff;background:${BRAND_HEX};text-align:left;">Item</td><td style="${headCell}">${escapeHtml(T1F_LABEL)}</td><td style="${headCell}">${escapeHtml(COMPETITOR_LABEL)}</td></tr>`,
    comparisonRowsHtml,
    `</table>`,
    `<table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;margin-bottom:14px;background:#ecfdf5;border:2px solid #6ee7b7;border-radius:8px;">${savingsHtml}</table>`,
    disclaimerHtml,
    `</div>`,
  ].join("");
}
