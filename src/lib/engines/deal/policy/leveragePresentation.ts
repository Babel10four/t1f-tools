import type { DealAnalyzeRequestV1 } from "../schemas/canonical-request";
import type { DealAnalyzeLoanOutV1 } from "../schemas/canonical-response";
import type {
  DealAnalyzeBindingLegV1,
  DealAnalyzeGoverningLeverageMetricV1,
} from "../schemas/deal-engine-v1-enums";
import type { PurchasePolicyBreakdown } from "./purchaseMax";
import type { RefinancePolicyMaxResult } from "./refinanceMax";

export type { DealAnalyzeGoverningLeverageMetricV1 } from "../schemas/deal-engine-v1-enums";

function approxEqualCents(a: number, b: number): boolean {
  return Math.abs(a - b) <= 0.01;
}

function ltvPct(loanAmount: number, basis: number): number {
  return Math.round((loanAmount / basis) * 10000) / 100;
}

export function isPurchaseNoRehabPolicyMappingPending(
  req: DealAnalyzeRequestV1,
): boolean {
  return (
    req.deal.purpose === "purchase" && (req.deal.rehabBudget ?? 0) === 0
  );
}

export function inferPurchaseBindingLeg(
  breakdown: PurchasePolicyBreakdown,
): DealAnalyzeBindingLegV1 {
  const { costBasisCap, arvCap, policyMax, tier12AdvanceRule } = breakdown;
  if (arvCap === undefined) {
    return tier12AdvanceRule === true ? "advance_sum" : "ltc";
  }
  const ltcLeg = tier12AdvanceRule === true ? "advance_sum" : "ltc";
  if (approxEqualCents(policyMax, costBasisCap) && approxEqualCents(policyMax, arvCap)) {
    return "tie";
  }
  if (approxEqualCents(policyMax, arvCap) && arvCap < costBasisCap) {
    return "arv_ltv";
  }
  if (approxEqualCents(policyMax, costBasisCap) && costBasisCap < arvCap) {
    return ltcLeg;
  }
  return "tie";
}

function governingFromPurchaseBinding(
  binding: DealAnalyzeBindingLegV1,
): DealAnalyzeGoverningLeverageMetricV1 | undefined {
  switch (binding) {
    case "arv_ltv":
      return "arv_ltv";
    case "ltc":
    case "advance_sum":
      return "ltc";
    case "tie":
      return undefined;
    case "aiv_ltv":
      return "aiv_ltv";
    case "none":
    case "arv_ltv_refi":
    case "aiv_ltv_refi":
      return undefined;
  }
}

/**
 * Adds explicit leverage metrics and binding leg for POLICY-ENGINE-REWRITE (Phase A).
 * `loan.ltv` remains populated by legacy `attachLtv` rules until migration Phase D.
 */
export function enrichLoanWithLeveragePresentation(
  loan: DealAnalyzeLoanOutV1,
  req: DealAnalyzeRequestV1,
  refi: RefinancePolicyMaxResult,
  purchaseBreakdown: PurchasePolicyBreakdown | undefined,
): DealAnalyzeLoanOutV1 {
  const amt = loan.amount;
  const arv = req.property?.arv;
  const asIs = req.property?.asIsValue;

  let arvLtv: number | undefined;
  let aivLtv: number | undefined;
  if (amt !== undefined && arv !== undefined && typeof arv === "number" && arv > 0) {
    arvLtv = ltvPct(amt, arv);
  }
  if (
    amt !== undefined &&
    asIs !== undefined &&
    typeof asIs === "number" &&
    asIs > 0
  ) {
    aivLtv = ltvPct(amt, asIs);
  }

  let bindingLeg: DealAnalyzeBindingLegV1 = "none";
  let governingLeverageMetric: DealAnalyzeGoverningLeverageMetricV1 | undefined;

  if (req.deal.purpose === "purchase" && purchaseBreakdown) {
    bindingLeg = inferPurchaseBindingLeg(purchaseBreakdown);
    governingLeverageMetric = governingFromPurchaseBinding(bindingLeg);
  } else if (
    req.deal.purpose === "refinance" &&
    refi.basis !== undefined &&
    refi.basis > 0 &&
    amt !== undefined
  ) {
    bindingLeg =
      refi.basisSource === "arv" ? "arv_ltv_refi" : "aiv_ltv_refi";
    governingLeverageMetric =
      refi.basisSource === "arv" ? "arv_ltv" : "aiv_ltv";
  }

  if (isPurchaseNoRehabPolicyMappingPending(req)) {
    governingLeverageMetric = undefined;
  }

  const out: DealAnalyzeLoanOutV1 = {
    ...loan,
    bindingLeg,
    ...(arvLtv !== undefined ? { arvLtv } : {}),
    ...(aivLtv !== undefined ? { aivLtv } : {}),
    ...(governingLeverageMetric !== undefined
      ? { governingLeverageMetric }
      : {}),
  };

  return out;
}
