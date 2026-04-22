import type { DealAnalyzeRequestV1 } from "../schemas/canonical-request";
import { POLICY_REFINANCE_MAX_LTV_PCT } from "./constants";

export type RefinanceBasisSource = "as_is" | "arv";

function defaultRefiLtvCap(): number {
  return POLICY_REFINANCE_MAX_LTV_PCT;
}

export type RefinancePolicyMaxResult =
  | { policyMax: number; basis: number; basisSource: RefinanceBasisSource }
  | { policyMax: undefined; basis: undefined; basisSource: undefined };

/**
 * Refinance policy max: single basis — as-is first, else ARV; indeterminate if neither > 0.
 */
export function refinancePolicyMax(
  req: DealAnalyzeRequestV1,
  refinanceMaxLtvPct: number = defaultRefiLtvCap(),
): RefinancePolicyMaxResult {
  const p = req.property;
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
