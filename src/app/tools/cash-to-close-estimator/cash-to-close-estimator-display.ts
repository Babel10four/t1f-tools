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
]);
const TITLE_INSURANCE_LABEL = "Estimated closing costs";

const TOTAL_CASH_LABEL = "Total estimated cash to close";

const POINTS_FEES_FOOTNOTE =
  "Combines lender points and lender fees. Title/insurance costs are not included in the cash-to-close estimate.";

export type CashToCloseDisplayLine = {
  label: string;
  amount: number;
  /** Secondary line, e.g. percent of purchase for down payment */
  sublabel?: string;
  /** Disclosure under merged fees row */
  footnote?: string;
};

export type CashToCloseLoanCostSummary = {
  basisLabel: "Down payment" | "Payoff / unwind amount";
  basisAmount: number;
  loanFees: number;
  titleInsuranceEstimate: number;
  /**
   * (Per diem × days from assumed closing through month-end, inclusive) + first full month in advance.
   * {@link buildCashToCloseLoanCostSummary} uses `asOfDate` as the closing date (defaults to today).
   */
  interestCosts: number | null;
  perDiem: number | null;
  remainingDaysInMonth: number | null;
  firstFullMonthInterest: number | null;
  /** basis + loan fees + interestCosts (title/insurance excluded) */
  estimatedLoanCostsExcludingTitleInsurance: number | null;
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * UI-only presentation of server cash-to-close lines (does not change API contract).
 * - Purchase: "Borrower equity" → "Down payment".
 * - Merges points + lender fees into one "Loan fees" row.
 * - Breaks out title/insurance estimate from loan costs.
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
        label: "Loan fees (points + lender fees)",
        amount: roundMoney(sum),
        footnote: POINTS_FEES_FOOTNOTE,
      });
      continue;
    }

    if (row.label === TITLE_INSURANCE_LABEL) {
      // Deliberately omit title/insurance dollars from displayed totals and line items.
      i += 1;
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
 * Display-only interest-only monthly payment (not additional engine policy).
 */
export function estimateInterestOnlyMonthlyPayment(
  loan: DealAnalyzeLoanOutV1,
  pricing: DealAnalyzePricingOutV1,
): number | null {
  const principal = loan.amount;
  const annual = pricing.noteRatePercent;

  if (
    principal === undefined ||
    !Number.isFinite(principal) ||
    principal <= 0 ||
    annual === null ||
    annual === undefined ||
    !Number.isFinite(annual) ||
    annual < 0
  ) {
    return null;
  }

  const r = monthlyRateFromAnnualPercent(annual);
  return roundMoney(principal * r);
}

function daysInMonth(year: number, monthZeroIndexed: number): number {
  return new Date(year, monthZeroIndexed + 1, 0).getDate();
}

function sumByLabels(items: DealAnalyzeCashLineV1[], labels: Set<string>): number {
  return roundMoney(
    items.reduce((sum, row) => (labels.has(row.label) ? sum + row.amount : sum), 0),
  );
}

function sumByLabel(items: DealAnalyzeCashLineV1[], label: string): number {
  return roundMoney(
    items.reduce((sum, row) => (row.label === label ? sum + row.amount : sum), 0),
  );
}

/**
 * Product-facing summary used by Cash to Close screen:
 * - include: down payment/payoff + loan fees + interest costs
 * - exclude: title/insurance estimate
 */
export function buildCashToCloseLoanCostSummary(input: {
  flow: "purchase" | "refinance";
  response: DealAnalyzeResponseV1;
  /** Assumed closing date for partial-month per diem (defaults to now). */
  asOfDate?: Date;
}): CashToCloseLoanCostSummary {
  const { flow, response } = input;
  const asOf = input.asOfDate ?? new Date();
  const basisLabel =
    flow === "purchase" ? "Down payment" : "Payoff / unwind amount";
  const basisAmount = sumByLabel(
    response.cashToClose.items,
    flow === "purchase" ? "Borrower equity" : "Payoff / unwind amount",
  );
  const loanFees = sumByLabels(response.cashToClose.items, FEE_LINE_LABELS);
  const titleInsuranceEstimate = sumByLabel(
    response.cashToClose.items,
    TITLE_INSURANCE_LABEL,
  );
  const hasRecognizedBasisOrFees = basisAmount > 0 || loanFees > 0;

  const principal =
    response.loan.acquisitionLoanAmount ?? response.loan.amount ?? undefined;
  const annualRatePct = response.pricing.noteRatePercent;
  if (
    !hasRecognizedBasisOrFees ||
    principal === undefined ||
    principal <= 0 ||
    annualRatePct === null ||
    annualRatePct === undefined ||
    annualRatePct < 0
  ) {
    return {
      basisLabel,
      basisAmount,
      loanFees,
      titleInsuranceEstimate,
      interestCosts: null,
      perDiem: null,
      remainingDaysInMonth: null,
      firstFullMonthInterest: null,
      estimatedLoanCostsExcludingTitleInsurance: null,
    };
  }

  /** Closing = `asOf` (typically today): count that calendar day through month-end, inclusive. */
  const dim = daysInMonth(asOf.getFullYear(), asOf.getMonth());
  const remainingDays = Math.max(0, dim - asOf.getDate() + 1);
  const perDiem = roundMoney((principal * (annualRatePct / 100)) / 360);
  const firstFullMonthInterest = roundMoney((principal * (annualRatePct / 100)) / 12);
  const interestCosts = roundMoney(perDiem * remainingDays + firstFullMonthInterest);
  const estimatedLoanCostsExcludingTitleInsurance = roundMoney(
    basisAmount + loanFees + interestCosts,
  );
  return {
    basisLabel,
    basisAmount,
    loanFees,
    titleInsuranceEstimate,
    interestCosts,
    perDiem,
    remainingDaysInMonth: remainingDays,
    firstFullMonthInterest,
    estimatedLoanCostsExcludingTitleInsurance,
  };
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
  const summary = buildCashToCloseLoanCostSummary({ flow, response });

  const interestOnlyMonthly = estimateInterestOnlyMonthlyPayment(
    response.loan,
    response.pricing,
  );
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
  if (interestOnlyMonthly !== null) {
    lines.push(`Est. monthly payment (interest-only): ${formatMoney(interestOnlyMonthly)}`);
  } else {
    lines.push("Est. monthly payment (interest-only): —");
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
  lines.push(`${summary.basisLabel}: ${formatMoney(summary.basisAmount)}`);
  lines.push(`Loan fees: ${formatMoney(summary.loanFees)}`);
  lines.push(
    `Interest costs: ${formatMoney(summary.interestCosts)}${
      summary.interestCosts === null
        ? " (note rate required)"
        : ` (per diem ${formatMoney(summary.perDiem)} × ${summary.remainingDaysInMonth} calendar days from assumed closing through month-end, inclusive, + first full month ${formatMoney(summary.firstFullMonthInterest)})`
    }`,
  );
  lines.push(
    "Assumed closing date for interest: today (when this summary is generated).",
  );
  lines.push(
    `Estimated loan costs (excludes title/insurance): ${formatMoney(summary.estimatedLoanCostsExcludingTitleInsurance)}`,
  );
  lines.push(
    "Title/insurance: not included in this cash-to-close estimate.",
  );
  lines.push("");
  lines.push(
    "Indicative internal estimate only — not a Closing Disclosure or final settlement. Title/insurance are estimated separately and excluded from loan-cost totals.",
  );
  return lines.join("\n");
}
