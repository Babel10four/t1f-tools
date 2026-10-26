import type { DealAnalyzeRequestV1 } from "../schemas/canonical-request";
import { POLICY_REFINANCE_MAX_LTV_PCT } from "./constants";

export type RefinanceBasisSource = "as_is" | "arv";

/** Credit Policy v8.2026, table 4.1: seasoned refinance with SOW, T0/T1. */
export const SEASONED_REHAB_MAX_ARV_LTV_PCT = 0.7;

function isSeasonedRefinance(req: DealAnalyzeRequestV1): boolean {
  return req.deal.purpose === "refinance" &&
    req.programContext?.scenario === "refinance_seasoned";
}

export function isSeasonedRehabRefinance(req: DealAnalyzeRequestV1): boolean {
  return isSeasonedRefinance(req) && req.deal.rehabBudget > 0;
}

/** Narrow verified branch only; other tiers must not inherit the generic refi cap. */
export function seasonedRehabPolicyIssue(req: DealAnalyzeRequestV1): {
  code: "SEASONED_REFINANCE_POLICY_UNAVAILABLE" | "MISSING_COLLATERAL_VALUE";
  title: string;
  detail: string;
} | undefined {
  if (!isSeasonedRefinance(req)) return undefined;
  if (!(req.deal.rehabBudget > 0) || req.assumptions?.borrowingRehabFunds !== true) {
    return {
      code: "SEASONED_REFINANCE_POLICY_UNAVAILABLE",
      title: "Seasoned refinance scenario requires financed rehab",
      detail: "The explicit seasoned refinance scenario requires positive rehab and borrowingRehabFunds explicitly set to boolean true. Missing, invalid, declined, or no-rehab funding is outside this verified mapping; amounts are withheld instead of falling back to the generic as-is cap.",
    };
  }
  const tier = req.borrower?.experienceTier?.trim() ?? "";
  if (!/^(?:tier\s*|t)?[01]$/i.test(tier)) {
    return {
      code: "SEASONED_REFINANCE_POLICY_UNAVAILABLE",
      title: "Seasoned refinance tier policy unavailable",
      detail: tier
        ? "This seasoned refinance with rehab branch is verified only for Tier 0 and Tier 1. The supplied tier is unsupported; loan sizing and cash-to-close amounts are withheld pending policy review."
        : "A confirmed Tier 0 or Tier 1 input is required for seasoned refinance with rehab. Tier was not provided; loan sizing and cash-to-close amounts are withheld.",
    };
  }
  const arv = req.property?.arv;
  if (typeof arv !== "number" || !Number.isFinite(arv) || arv <= 0) {
    return {
      code: "MISSING_COLLATERAL_VALUE",
      title: "Seasoned refinance requires a positive ARV",
      detail: "Seasoned refinance with rehab uses a 70% ARV total-loan cap. A positive ARV is required; as-is value cannot substitute, so loan sizing and cash-to-close amounts are withheld.",
    };
  }
  return undefined;
}

function defaultRefiLtvCap(): number {
  return POLICY_REFINANCE_MAX_LTV_PCT;
}

export type RefinancePolicyMaxResult =
  | { policyMax: number; basis: number; basisSource: RefinanceBasisSource }
  | { policyMax: undefined; basis: undefined; basisSource: undefined };

/**
 * Explicit seasoned rehab T0/T1: 70% ARV total cap; no as-is fallback.
 * Other refinance paths retain as-is first, else ARV, under the generic scalar.
 */
export function refinancePolicyMax(
  req: DealAnalyzeRequestV1,
  refinanceMaxLtvPct: number = defaultRefiLtvCap(),
): RefinancePolicyMaxResult {
  const p = req.property;
  if (isSeasonedRefinance(req)) {
    if (seasonedRehabPolicyIssue(req)) {
      return { policyMax: undefined, basis: undefined, basisSource: undefined };
    }
    const arv = p!.arv!;
    return {
      policyMax: Math.round(SEASONED_REHAB_MAX_ARV_LTV_PCT * arv * 100) / 100,
      basis: arv,
      basisSource: "arv",
    };
  }
  const asIs = p?.asIsValue;
  if (asIs !== undefined && typeof asIs === "number" && asIs > 0) {
    const policyMax =
      Math.round(refinanceMaxLtvPct * asIs * 100) / 100;
    return { policyMax, basis: asIs, basisSource: "as_is" };
  }
  const arv = p?.arv;
  if (arv !== undefined && typeof arv === "number" && arv > 0) {
    const policyMax =
      Math.round(refinanceMaxLtvPct * arv * 100) / 100;
    return { policyMax, basis: arv, basisSource: "arv" };
  }
  return { policyMax: undefined, basis: undefined, basisSource: undefined };
}
