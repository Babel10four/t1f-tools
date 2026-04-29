import type { DealAnalyzeRequestV1 } from "@/lib/engines/deal/schemas/canonical-request";
import type {
  DealAnalyzeCashLineV1,
  DealAnalyzeLoanOutV1,
  DealAnalyzePricingOutV1,
  DealAnalyzeResponseV1,
} from "@/lib/engines/deal/schemas/canonical-response";
import { formatMoney } from "../loan-structuring-assistant/display-helpers";

const FEE_LINE_LABELS = new Set([
  "Estimated points",
  "Estimated lender fees",
  "Estimated closing costs",
]);

const TOTAL_CASH_LABEL = "Total estimated cash to close";

const POINTS_FEES_FOOTNOTE =
  "Includes estimated lender points, lender fees, and third-party closing costs. Third-party closing fees are estimated.";

export type CashToCloseDisplayLine = {
  label: string;
  amount: number;
  /** Secondary line, e.g. percent of purchase for down payment */
  sublabel?: string;
  /** Disclosure under merged fees row */
  footnote?: string;
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * UI-only presentation of server cash-to-close lines (does not change API contract).
 * - Purchase: "Borrower equity" → "Down payment" with % of purchase when price known.
 * - Merges points + lender fees + closing into one "Total points & fees" row.
 */
export function transformCashToCloseDisplayLines(
  items: DealAnalyzeCashLineV1[],
  options: {
    purpose: "purchase" | "refinance";
    purchasePrice?: number;
  },
): CashToCloseDisplayLine[] {
  if (items.length === 0) {
    return [];
  }

  const totalIdx = items.findIndex((row) => row.label === TOTAL_CASH_LABEL);
  const middle =
    totalIdx >= 0 ? items.slice(0, totalIdx) : [...items];
  const tail = totalIdx >= 0 ? items.slice(totalIdx) : [];

  const out: CashToCloseDisplayLine[] = [];
  let i = 0;
  while (i < middle.length) {
    const row = middle[i]!;

    if (
      options.purpose === "purchase" &&
      row.label === "Borrower equity" &&
      options.purchasePrice !== undefined &&
      options.purchasePrice > 0
    ) {
      const pct = roundMoney((row.amount / options.purchasePrice) * 100);
      out.push({
        label: "Down payment",
        amount: row.amount,
        sublabel: `${pct}% of purchase price`,
      });
      i += 1;
      continue;
    }

    if (options.purpose === "purchase" && row.label === "Borrower equity") {
      out.push({ label: "Down payment", amount: row.amount });
      i += 1;
      continue;
    }

    if (FEE_LINE_LABELS.has(row.label)) {
      let sum = 0;
      while (i < middle.length && FEE_LINE_LABELS.has(middle[i]!.label)) {
        sum += middle[i]!.amount;
        i += 1;
      }
      out.push({
        label: "Total points & fees",
        amount: roundMoney(sum),
        footnote: POINTS_FEES_FOOTNOTE,
      });
      continue;
    }

    out.push({ label: row.label, amount: row.amount });
    i += 1;
  }

  for (const row of tail) {
    out.push({ label: row.label, amount: row.amount });
  }

  return out;
}

/** Monthly rate as decimal per month (e.g. 9% annual → 0.09/12). */
function monthlyRateFromAnnualPercent(annualPct: number): number {
  return annualPct / 100 / 12;
}

/**
 * Display-only payment estimates for confirmed / indicative terms (not additional engine policy).
 */
export function estimateMonthlyPayments(
  loan: DealAnalyzeLoanOutV1,
  pricing: DealAnalyzePricingOutV1,
): {
  interestOnlyPerMonth: number | null;
  amortizingPerMonth: number | null;
} {
  const principal = loan.amount;
  const annual = pricing.noteRatePercent;
  const months = loan.termMonths;

  if (
    principal === undefined ||
    !Number.isFinite(principal) ||
    principal <= 0 ||
    annual === null ||
    annual === undefined ||
    !Number.isFinite(annual) ||
    annual < 0
  ) {
    return { interestOnlyPerMonth: null, amortizingPerMonth: null };
  }

  const r = monthlyRateFromAnnualPercent(annual);
  const interestOnlyPerMonth = roundMoney(principal * r);

  if (
    months === null ||
    months === undefined ||
    !Number.isFinite(months) ||
    months <= 0
  ) {
    return { interestOnlyPerMonth, amortizingPerMonth: null };
  }

  const n = Math.floor(months);
  if (r === 0) {
    return { interestOnlyPerMonth, amortizingPerMonth: roundMoney(principal / n) };
  }
  const factor = Math.pow(1 + r, n);
  const amortizingPerMonth = roundMoney(
    (principal * r * factor) / (factor - 1),
  );
  return { interestOnlyPerMonth, amortizingPerMonth };
}

export function buildCashToCloseClientSummaryText(input: {
  flow: "purchase" | "refinance";
  response: DealAnalyzeResponseV1;
  request: DealAnalyzeRequestV1;
}): string {
  const { flow, response, request } = input;
  const purpose = flow === "purchase" ? "purchase" : "refinance";
  const purchasePrice = request.deal.purchasePrice;
  const displayLines = transformCashToCloseDisplayLines(
    response.cashToClose.items,
    { purpose, purchasePrice },
  );

  const payments = estimateMonthlyPayments(response.loan, response.pricing);
  const lines: string[] = [];
  lines.push(`Cash to close summary — ${flow === "purchase" ? "Purchase (bridge)" : "Refinance (bridge)"}`);
  lines.push("");
  lines.push(`Pricing status: ${response.pricing.status}`);
  if (
    response.pricing.noteRatePercent !== null &&
    response.pricing.noteRatePercent !== undefined
  ) {
    lines.push(`Note rate: ${response.pricing.noteRatePercent}%`);
  } else {
    lines.push("Note rate: — (enter Note rate (%) on the form to include in estimates)");
  }
  lines.push(`Loan amount: ${formatMoney(response.loan.amount)}`);
  const term = response.loan.termMonths;
  lines.push(
    `Term (months): ${term === null || term === undefined ? "—" : String(term)}`,
  );
  if (payments.interestOnlyPerMonth !== null) {
    lines.push(
      `Est. monthly payment (interest-only): ${formatMoney(payments.interestOnlyPerMonth)}`,
    );
  } else {
    lines.push("Est. monthly payment (interest-only): —");
  }
  if (payments.amortizingPerMonth !== null) {
    lines.push(
      `Est. monthly payment (fully amortizing): ${formatMoney(payments.amortizingPerMonth)}`,
    );
  } else {
    lines.push("Est. monthly payment (fully amortizing): —");
  }
  lines.push("");
  lines.push("Cash to close (display)");
  for (const row of displayLines) {
    lines.push(`- ${row.label}: ${formatMoney(row.amount)}`);
    if (row.sublabel) {
      lines.push(`  ${row.sublabel}`);
    }
    if (row.footnote) {
      lines.push(`  ${row.footnote}`);
    }
  }
  lines.push("");
  lines.push(
    `Estimated cash to close (total): ${formatMoney(response.cashToClose.estimatedTotal)}`,
  );
  lines.push("");
  lines.push(
    "Indicative internal estimate only — not a Closing Disclosure or final settlement. Third-party fees are estimated.",
  );
  return lines.join("\n");
}
