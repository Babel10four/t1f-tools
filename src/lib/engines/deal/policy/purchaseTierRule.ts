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

/**
 * Verified 2026-11-02 against BA Credit Policy v8.2026 §§2.2 and 4.1.
 * LTC is initial loan / purchase cost basis; financed rehab is separate.
 * A published Tier 4 rule supersedes this source-backed fallback.
 */
export const VERIFIED_TIER4_PURCHASE_POLICY = {
  source: "BA Credit Policy v8.2026",
  sourceUrl: "https://docs.google.com/document/d/1ceFR-r2Bi9cQOU-CVB6XwKCSSQehKj3pqcfAyhpLhRs/edit",
  sourceSections: "2.2, 4.1",
  verifiedOn: "2026-11-02",
  initialAdvancePct: 0.75,
  rehabAdvancePct: 1,
  maxArvLtvPct: 0.7,
} as const;

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
  const publishedRule = tier === undefined ? undefined : calculator?.purchaseTierRules?.[tier];
  if (publishedRule) return publishedRule;
  if (tier === "4") {
    const { initialAdvancePct, rehabAdvancePct, maxArvLtvPct } = VERIFIED_TIER4_PURCHASE_POLICY;
    return { initialAdvancePct, rehabAdvancePct, maxArvLtvPct };
  }
  return undefined;
}

export function isUsingVerifiedTier4PurchaseRule(
  calculator: { purchaseTierRules?: PurchaseTierRules } | undefined,
  experienceTier: string | undefined,
): boolean {
  return normalizePurchaseTier(experienceTier) === "4" &&
    calculator?.purchaseTierRules?.["4"] === undefined;
}

/** Tier 3 must not silently receive the provisional generic cost-basis fallback. */
export function isPurchaseTierPolicyMissing(
  calculator: { purchaseTierRules?: PurchaseTierRules } | undefined,
  experienceTier: string | undefined,
): boolean {
  return normalizePurchaseTier(experienceTier) === "3" &&
    resolvePurchaseTierRule(calculator, experienceTier) === undefined;
}
