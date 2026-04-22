import type { DealAnalyzeRequestV1 } from "../schemas/canonical-request";
import type { DealAnalyzeLoanOutV1 } from "../schemas/canonical-response";
import { isBorrowerTier1Or2 } from "./borrowerTier";
import { TIER12_INITIAL_ADVANCE_PCT } from "./constants";

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
 * Splits total loan across acquisition vs rehab using the same cost mix as purchase policy
 * (purchase price + rehab) or refinance (payoff + rehab). When not borrowing rehab or rehab
 * budget is zero, the full amount is treated as acquisition.
 */
/**
 * Tier 1/2 purchase: fund rehab up to budget first, then acquisition up to 90% of purchase.
 */
function tier12PurchaseWaterfall(
  totalLoan: number,
  purchasePrice: number,
  rehabBudget: number,
): { acquisitionLoanAmount: number; rehabLoanAmount: number } {
  const maxAcq = money(TIER12_INITIAL_ADVANCE_PCT * purchasePrice);
  let rehabLoan = money(Math.min(rehabBudget, totalLoan));
  let acquisitionLoan = money(totalLoan - rehabLoan);
  if (acquisitionLoan > maxAcq) {
    acquisitionLoan = maxAcq;
    rehabLoan = money(totalLoan - acquisitionLoan);
  }
  if (rehabLoan > rehabBudget) {
    rehabLoan = money(rehabBudget);
    acquisitionLoan = money(totalLoan - rehabLoan);
    if (acquisitionLoan > maxAcq) {
      acquisitionLoan = maxAcq;
      rehabLoan = money(totalLoan - acquisitionLoan);
    }
  }
  return {
    acquisitionLoanAmount: acquisitionLoan,
    rehabLoanAmount: rehabLoan,
  };
}

export function splitAcquisitionRehabLoan(params: {
  totalLoan: number;
  purpose: "purchase" | "refinance";
  purchasePrice?: number;
  payoffAmount?: number;
  rehabBudget: number;
  borrowingRehabFunds: boolean | undefined;
  /** Tier 1/2 purchase bridge split (90% / 100% advances), rehab-first when short. */
  useTier12PurchaseWaterfall?: boolean;
}): { acquisitionLoanAmount: number; rehabLoanAmount: number } {
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
    params.purchasePrice !== undefined &&
    params.useTier12PurchaseWaterfall
  ) {
    return tier12PurchaseWaterfall(
      totalLoan,
      params.purchasePrice,
      rehabBudget,
    );
  }

  if (purpose === "purchase" && params.purchasePrice !== undefined) {
    const denom = params.purchasePrice + rehabBudget;
    if (!(denom > 0)) {
      return {
        acquisitionLoanAmount: money(totalLoan),
        rehabLoanAmount: 0,
      };
    }
    const rehabLoanAmount = money(totalLoan * (rehabBudget / denom));
    return {
      acquisitionLoanAmount: money(totalLoan - rehabLoanAmount),
      rehabLoanAmount,
    };
  }

  if (purpose === "refinance") {
    const payoff = params.payoffAmount ?? 0;
    const denom = payoff + rehabBudget;
    if (!(denom > 0)) {
      return {
        acquisitionLoanAmount: money(totalLoan),
        rehabLoanAmount: 0,
      };
    }
    const rehabLoanAmount = money(totalLoan * (rehabBudget / denom));
    return {
      acquisitionLoanAmount: money(totalLoan - rehabLoanAmount),
      rehabLoanAmount,
    };
  }

  return {
    acquisitionLoanAmount: money(totalLoan),
    rehabLoanAmount: 0,
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
  const tier12Waterfall =
    deal.purpose === "purchase" &&
    deal.purchasePrice !== undefined &&
    isBorrowerTier1Or2(req.borrower?.experienceTier);
  const split = splitAcquisitionRehabLoan({
    totalLoan: amt,
    purpose: deal.purpose,
    purchasePrice: deal.purchasePrice,
    payoffAmount: deal.payoffAmount,
    rehabBudget,
    borrowingRehabFunds: parsed.borrowingRehabFunds,
    useTier12PurchaseWaterfall: tier12Waterfall,
  });

  return {
    ...out,
    acquisitionLoanAmount: split.acquisitionLoanAmount,
    rehabLoanAmount: split.rehabLoanAmount,
  };
}
