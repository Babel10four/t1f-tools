import type { DealAnalyzeCashLineV1 } from "../schemas/canonical-response";
import type { DealPurpose } from "../schemas/deal-analyze-constants";
import {
  POLICY_CTC_CLOSING_COSTS_PCT,
  POLICY_CTC_LENDER_FEES_PCT,
  POLICY_CTC_POINTS_PCT,
} from "./constants";

/** @see docs/business-rules/deal-engine-v1-assumptions.md — exact labels, order, rounding. */
const PURCHASE_LABELS = [
  "Borrower equity",
  "Estimated points",
  "Estimated lender fees",
  "Estimated closing costs",
  "Holdback / reserve (if applicable)",
  "Total estimated cash to close",
] as const;

const REFINANCE_LABELS = [
  "Payoff / unwind amount",
  "Estimated points",
  "Estimated lender fees",
  "Estimated closing costs",
  "Reserves / escrows (if applicable)",
  "Total estimated cash to close",
] as const;

/** Half-up to cents (deterministic). */
function money(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Deterministic cash-to-close lines: fixed label strings and order; each component
 * rounded with `money()`; line 6 amount equals sum of lines 1–5; `estimatedTotal`
 * must equal that same total (sum-of-lines contract, including the total row).
 */
/** When any field is set, `Estimated points` / `Estimated lender fees` use actual origination on total loan (see assumptions), not CTC policy % of purchase price. */
export type CashToCloseOriginationInputV1 = {
  /** Total loan (acquisition + rehab) — same basis as term sheet “origination from points”. */
  feeBasisTotalLoan: number;
  /** Percent of `feeBasisTotalLoan` (e.g. 0.65 → 0.65%). Omitted or missing → 0 dollars for points. */
  originationPointsPercent?: number;
  /** Flat dollars for `Estimated lender fees`. Omitted → 0. */
  originationFlatFee?: number;
};

function hasOriginationFeePath(
  o: CashToCloseOriginationInputV1 | undefined,
): o is CashToCloseOriginationInputV1 {
  if (!o) {
    return false;
  }
  if (!(o.feeBasisTotalLoan > 0)) {
    return false;
  }
  return (
    o.originationPointsPercent !== undefined || o.originationFlatFee !== undefined
  );
}

export function buildCashToCloseLinesPurchase(params: {
  purchasePrice: number;
  /** Initial / acquisition loan (not total loan incl. rehab) — borrower equity = purchasePrice − this. */
  loanAmount: number;
  ctcPointsPct?: number;
  ctcLenderFeesPct?: number;
  ctcClosingCostsPct?: number;
  /** Overrides policy CTC points/fees lines when present (Term Sheet / LSA origination fields). */
  origination?: CashToCloseOriginationInputV1;
}): { items: DealAnalyzeCashLineV1[]; estimatedTotal: number } {
  const {
    purchasePrice,
    loanAmount,
    ctcPointsPct = POLICY_CTC_POINTS_PCT,
    ctcLenderFeesPct = POLICY_CTC_LENDER_FEES_PCT,
    ctcClosingCostsPct = POLICY_CTC_CLOSING_COSTS_PCT,
    origination,
  } = params;
  const ref = purchasePrice;

  const borrowerEquity = money(Math.max(0, purchasePrice - loanAmount));
  let points: number;
  let lenderFees: number;
  if (hasOriginationFeePath(origination)) {
    const basis = origination.feeBasisTotalLoan;
    const ptsPct = origination.originationPointsPercent ?? 0;
    const flat = origination.originationFlatFee ?? 0;
    points = money((basis * ptsPct) / 100);
    lenderFees = money(flat);
  } else {
    points = money(ref * ctcPointsPct);
    lenderFees = money(ref * ctcLenderFeesPct);
  }
  const closing = money(ref * ctcClosingCostsPct);
  const holdback = 0;
  const components = [borrowerEquity, points, lenderFees, closing, holdback];
  const total = money(components.reduce((s, x) => s + x, 0));

  const items: DealAnalyzeCashLineV1[] = [
    { label: PURCHASE_LABELS[0], amount: borrowerEquity },
    { label: PURCHASE_LABELS[1], amount: points },
    { label: PURCHASE_LABELS[2], amount: lenderFees },
    { label: PURCHASE_LABELS[3], amount: closing },
    { label: PURCHASE_LABELS[4], amount: holdback },
    { label: PURCHASE_LABELS[5], amount: total },
  ];

  return { items, estimatedTotal: total };
}

export function buildCashToCloseLinesRefinance(params: {
  referenceAmount: number;
  ctcPointsPct?: number;
  ctcLenderFeesPct?: number;
  ctcClosingCostsPct?: number;
  origination?: CashToCloseOriginationInputV1;
}): { items: DealAnalyzeCashLineV1[]; estimatedTotal: number } {
  const {
    referenceAmount,
    ctcPointsPct = POLICY_CTC_POINTS_PCT,
    ctcLenderFeesPct = POLICY_CTC_LENDER_FEES_PCT,
    ctcClosingCostsPct = POLICY_CTC_CLOSING_COSTS_PCT,
    origination,
  } = params;
  const ref = referenceAmount;
  const payoff = money(ref);
  let points: number;
  let lenderFees: number;
  if (hasOriginationFeePath(origination)) {
    const basis = origination.feeBasisTotalLoan;
    const ptsPct = origination.originationPointsPercent ?? 0;
    const flat = origination.originationFlatFee ?? 0;
    points = money((basis * ptsPct) / 100);
    lenderFees = money(flat);
  } else {
    points = money(ref * ctcPointsPct);
    lenderFees = money(ref * ctcLenderFeesPct);
  }
  const closing = money(ref * ctcClosingCostsPct);
  const reserves = 0;
  const components = [payoff, points, lenderFees, closing, reserves];
  const total = money(components.reduce((s, x) => s + x, 0));

  const items: DealAnalyzeCashLineV1[] = [
    { label: REFINANCE_LABELS[0], amount: payoff },
    { label: REFINANCE_LABELS[1], amount: points },
    { label: REFINANCE_LABELS[2], amount: lenderFees },
    { label: REFINANCE_LABELS[3], amount: closing },
    { label: REFINANCE_LABELS[4], amount: reserves },
    { label: REFINANCE_LABELS[5], amount: total },
  ];

  return { items, estimatedTotal: total };
}

export function cashToCloseLinesForPurpose(
  purpose: DealPurpose,
  params:
    | { purchasePrice: number; loanAmount: number }
    | { referenceAmount: number },
  ctc?: {
    ctcPointsPct: number;
    ctcLenderFeesPct: number;
    ctcClosingCostsPct: number;
  },
  origination?: CashToCloseOriginationInputV1,
): { items: DealAnalyzeCashLineV1[]; estimatedTotal: number } {
  const mult = ctc
    ? {
        ctcPointsPct: ctc.ctcPointsPct,
        ctcLenderFeesPct: ctc.ctcLenderFeesPct,
        ctcClosingCostsPct: ctc.ctcClosingCostsPct,
      }
    : {};
  if (purpose === "purchase") {
    const p = params as { purchasePrice: number; loanAmount: number };
    return buildCashToCloseLinesPurchase({ ...p, ...mult, origination });
  }
  const p = params as { referenceAmount: number };
  return buildCashToCloseLinesRefinance({ ...p, ...mult, origination });
}
