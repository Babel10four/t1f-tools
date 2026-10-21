import {
  TIER12_INITIAL_ADVANCE_PCT,
  TIER12_REHAB_ADVANCE_PCT,
  TIER12_MAX_ARV_LTV_PCT,
} from "./constants";

/** Fractions (0–1), not percentages. Published config supplies non-legacy tiers. */
export type PurchaseTierRule = {
  initialAdvancePct: number;
  rehabAdvancePct: number;
  maxArvLtvPct: number;
};

export type PurchaseTierRules = Record<string, PurchaseTierRule>;

export function normalizePurchaseTier(tier: string | undefined): string | undefined {
  const match = /^(?:tier\s*)?([1-9]\d*)$/i.exec(tier?.trim() ?? "");
  return match?.[1];
}

/** Pure shared lookup: no database access or client-supplied policy overrides. */
export function resolvePurchaseTierRule(
  calculator: { purchaseTierRules?: PurchaseTierRules } | undefined,
  experienceTier: string | undefined,
): PurchaseTierRule | undefined {
  const tier = normalizePurchaseTier(experienceTier);
  // Preserve established tier 1/2 behavior; this repair does not change those terms.
  if (tier === "1" || tier === "2") {
    return {
      initialAdvancePct: TIER12_INITIAL_ADVANCE_PCT,
      rehabAdvancePct: TIER12_REHAB_ADVANCE_PCT,
      maxArvLtvPct: TIER12_MAX_ARV_LTV_PCT,
    };
  }
  return tier === undefined ? undefined : calculator?.purchaseTierRules?.[tier];
}

/** Tier 3 must not silently receive the provisional generic cost-basis fallback. */
export function isPurchaseTierPolicyMissing(
  calculator: { purchaseTierRules?: PurchaseTierRules } | undefined,
  experienceTier: string | undefined,
): boolean {
  return normalizePurchaseTier(experienceTier) === "3" &&
    resolvePurchaseTierRule(calculator, experienceTier) === undefined;
}
