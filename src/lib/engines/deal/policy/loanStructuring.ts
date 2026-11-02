import type { DealAnalyzeRequestV1 } from "../schemas/canonical-request";
import type { DealAnalyzeLoanOutV1 } from "../schemas/canonical-response";
import type { PurchaseTierRule } from "./purchaseTierRule";

function money(n: number): number {
  return Math.round(n * 100) / 100;
}

function ltcPercent(totalLoan: number, costBasis: number): number {
  if (!(costBasis > 0)) {
    return 0;
  }
  return Math.round((totalLoan / costBasis) * 10000) / 100;
}

export type ParsedStructuringAssumptions = {
  borrowingRehabFunds: boolean | undefined;
  originationPointsPercent: number | undefined;
  originationFlatFee: number | undefined;
};

/**
 * Reads optional structuring fields from `assumptions` (best-effort; unknown keys ignored).
 */
export function parseDealStructuringAssumptions(
  assumptions: Record<string, unknown> | undefined,
): ParsedStructuringAssumptions {
  if (!assumptions) {
    return {
      borrowingRehabFunds: undefined,
      originationPointsPercent: undefined,
      originationFlatFee: undefined,
    };
  }
  const br = assumptions.borrowingRehabFunds;
  const borrowingRehabFunds =
    typeof br === "boolean" ? br : undefined;

  const op = assumptions.originationPointsPercent;
  const originationPointsPercent =
    typeof op === "number" && Number.isFinite(op) && op >= 0 ? op : undefined;

  const of = assumptions.originationFlatFee;
  const originationFlatFee =
    typeof of === "number" && Number.isFinite(of) && of >= 0 ? of : undefined;

  return { borrowingRehabFunds, originationPointsPercent, originationFlatFee };
}

/**
 * Rehab funding is binary for every tier and purpose: none, or the full budget.
 * Policy sizing caps the total first; any reduction comes from initial proceeds,
 * never from the rehab holdback. An infeasible total has no valid allocation.
 */
export function splitAcquisitionRehabLoan(params: {
  totalLoan: number;
  purpose: "purchase" | "refinance";
  purchasePrice?: number;
  payoffAmount?: number;
  rehabBudget: number;
  borrowingRehabFunds: boolean | undefined;
  /** Retained for callers; all tiers now use the same full-rehab-first allocation. */
  useTier12PurchaseWaterfall?: boolean;
  /** Published purchase rule; supplied by the same breakdown that sized the total. */
  purchaseAdvanceRule?: PurchaseTierRule;
}): { acquisitionLoanAmount: number; rehabLoanAmount: number } | undefined {
  const { totalLoan, purpose, rehabBudget } = params;
  const useRehabSplit =
    params.borrowingRehabFunds !== false && rehabBudget > 0;

  if (!useRehabSplit) {
    return {
      acquisitionLoanAmount: money(totalLoan),
      rehabLoanAmount: 0,
    };
  }

  if (
    purpose === "purchase" &&
    params.purchaseAdvanceRule &&
    params.purchaseAdvanceRule.rehabAdvancePct !== 1
  ) {
    return undefined;
  }

  const rehabLoanAmount = money(rehabBudget);
  if (money(totalLoan) < rehabLoanAmount) {
    return undefined;
  }

  return {
    acquisitionLoanAmount: money(money(totalLoan) - rehabLoanAmount),
    rehabLoanAmount,
  };
}

function costBasisForLtc(req: DealAnalyzeRequestV1): number | undefined {
  const { deal } = req;
  const rehab = deal.rehabBudget ?? 0;
  if (deal.purpose === "purchase" && deal.purchasePrice !== undefined) {
    const basis = deal.purchasePrice + rehab;
    return basis > 0 ? basis : undefined;
  }
  if (deal.purpose === "refinance") {
    const payoff = deal.payoffAmount ?? 0;
    const basis = payoff + rehab;
    return basis > 0 ? basis : undefined;
  }
  return undefined;
}

/**
 * Adds acquisition/rehab split, LTC, and origination echoes onto `loan`.
 */
export function applyLoanStructuring(
  loan: DealAnalyzeLoanOutV1,
  req: DealAnalyzeRequestV1,
  purchaseAdvanceRule?: PurchaseTierRule,
): DealAnalyzeLoanOutV1 {
  const parsed = parseDealStructuringAssumptions(req.assumptions);
  let out: DealAnalyzeLoanOutV1 = { ...loan };

  if (parsed.originationPointsPercent !== undefined) {
    out = { ...out, originationPointsPercent: parsed.originationPointsPercent };
  }
  if (parsed.originationFlatFee !== undefined) {
    out = { ...out, originationFlatFee: parsed.originationFlatFee };
  }

  const amt = out.amount;
  const costBasis = costBasisForLtc(req);
  if (amt !== undefined && costBasis !== undefined) {
    out = {
      ...out,
      ltcPercent: ltcPercent(amt, costBasis),
    };
  }

  if (amt === undefined) {
    return out;
  }

  const { deal } = req;
  const rehabBudget = deal.rehabBudget ?? 0;
  const split = splitAcquisitionRehabLoan({
    totalLoan: amt,
    purpose: deal.purpose,
    purchasePrice: deal.purchasePrice,
    payoffAmount: deal.payoffAmount,
    rehabBudget,
    borrowingRehabFunds: parsed.borrowingRehabFunds,
    purchaseAdvanceRule,
  });

  // The analysis path emits a review flag before reaching this branch. Keep the
  // allocator safe for other callers too: never expose an infeasible partial loan.
  if (!split) {
    return {
      ...out,
      amount: undefined,
      ltv: undefined,
      ltcPercent: undefined,
      acquisitionLoanAmount: undefined,
      rehabLoanAmount: undefined,
    };
  }

  return {
    ...out,
    acquisitionLoanAmount: split.acquisitionLoanAmount,
    rehabLoanAmount: split.rehabLoanAmount,
  };
}
