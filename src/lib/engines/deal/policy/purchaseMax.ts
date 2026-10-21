import type { DealAnalyzeRequestV1 } from "../schemas/canonical-request";
import type { AnalysisFlag } from "../schemas/canonical-response";
import { isBorrowerTier1Or2 } from "./borrowerTier";
import {
  isPurchaseTierPolicyMissing,
  normalizePurchaseTier,
  resolvePurchaseTierRule,
  type PurchaseTierRule,
  type PurchaseTierRules,
} from "./purchaseTierRule";
import {
  POLICY_MAX_ARV_LTV_PCT,
  POLICY_MAX_LTC_PCT,
} from "./constants";

type PurchaseCaps = {
  maxLtcPct: number;
  maxArvLtvPct: number;
  purchaseTierRules?: PurchaseTierRules;
};

function defaultPurchaseCaps(): { maxLtcPct: number; maxArvLtvPct: number } {
  return { maxLtcPct: POLICY_MAX_LTC_PCT, maxArvLtvPct: POLICY_MAX_ARV_LTV_PCT };
}

/** Half-up to cents (same as cash-to-close lines). */
function money(n: number): number {
  return Math.round(n * 100) / 100;
}

function approxEqualCents(a: number, b: number): boolean {
  return Math.abs(a - b) <= 0.01;
}

/**
 * Supported purchase policy breakdown (TICKET-002 / TICKET-002A).
 * `ltcCap` equals the cost-basis (LTC) cap leg — same numeric source as `costBasisCap`.
 */
export type PurchasePolicyBreakdown = {
  basis: number;
  costBasisCap: number;
  /** Same as cost-basis cap leg (`maxLtcPct × basis`), or tier 1/2 advance-sum cap. */
  ltcCap: number;
  arvCap: number | undefined;
  policyMax: number;
  /** When true, `costBasisCap` / `ltcCap` are 90% of purchase + 100% of rehab (tier 1/2). */
  tier12AdvanceRule?: boolean;
  /** Resolved advance rule used for both sizing and allocation. */
  purchaseAdvanceRule?: PurchaseTierRule;
  purchaseTier?: string;
};

/**
 * Purchase policy maximum loan before recommended-amount clamp.
 * ARV leg omitted when `arv` missing or ≤ 0 (cost basis only).
 */
export function purchasePolicyBreakdown(
  req: DealAnalyzeRequestV1,
  caps: PurchaseCaps = defaultPurchaseCaps(),
): PurchasePolicyBreakdown | undefined {
  const { maxLtcPct, maxArvLtvPct } = caps;
  const { deal, property } = req;
  const purchasePrice = deal.purchasePrice;
  if (purchasePrice === undefined) {
    return undefined;
  }
  const rehab = deal.rehabBudget ?? 0;
  const basis = purchasePrice + rehab;
  if (!(basis > 0)) {
    return undefined;
  }

  const tier12 = isBorrowerTier1Or2(req.borrower?.experienceTier);
  const advanceRule = resolvePurchaseTierRule(caps, req.borrower?.experienceTier);
  if (isPurchaseTierPolicyMissing(caps, req.borrower?.experienceTier)) {
    return undefined;
  }
  if (advanceRule) {
    // Preserve legacy tier 1/2 behavior; configured tiers never include declined rehab proceeds.
    const financedRehab = !tier12 && req.assumptions?.borrowingRehabFunds === false
      ? 0 : rehab;
    const sumAdvanceCap = tier12
      ? money(advanceRule.initialAdvancePct * purchasePrice + advanceRule.rehabAdvancePct * rehab)
      : money(money(advanceRule.initialAdvancePct * purchasePrice) +
          money(advanceRule.rehabAdvancePct * financedRehab));
    const arv = property?.arv;
    if (arv !== undefined && typeof arv === "number" && arv > 0) {
      const arvCap = money(advanceRule.maxArvLtvPct * arv);
      const policyMax = money(Math.min(sumAdvanceCap, arvCap));
      return {
        basis,
        costBasisCap: sumAdvanceCap,
        ltcCap: sumAdvanceCap,
        arvCap,
        policyMax,
        ...(tier12 ? { tier12AdvanceRule: true } : {}),
        purchaseAdvanceRule: advanceRule,
        purchaseTier: normalizePurchaseTier(req.borrower?.experienceTier),
      };
    }
    return {
      basis,
      costBasisCap: sumAdvanceCap,
      ltcCap: sumAdvanceCap,
      arvCap: undefined,
      policyMax: sumAdvanceCap,
      ...(tier12 ? { tier12AdvanceRule: true } : {}),
      purchaseAdvanceRule: advanceRule,
      purchaseTier: normalizePurchaseTier(req.borrower?.experienceTier),
    };
  }

  const costBasisCap = money(maxLtcPct * basis);
  const ltcCap = costBasisCap;

  const arv = property?.arv;
  if (arv !== undefined && typeof arv === "number" && arv > 0) {
    const arvCap = money(maxArvLtvPct * arv);
    const policyMax = money(Math.min(costBasisCap, arvCap));
    return {
      basis,
      costBasisCap,
      ltcCap,
      arvCap,
      policyMax,
    };
  }

  const policyMax = costBasisCap;
  return {
    basis,
    costBasisCap,
    ltcCap,
    arvCap: undefined,
    policyMax,
  };
}

export function purchasePolicyMax(
  req: DealAnalyzeRequestV1,
  caps: PurchaseCaps = defaultPurchaseCaps(),
): number | undefined {
  return purchasePolicyBreakdown(req, caps)?.policyMax;
}

/**
 * TICKET-002A: diagnostic flags when both ARV and cost-basis legs apply.
 * No flags when only one leg (no positive ARV).
 */
export function purchaseBindingFlags(
  breakdown: PurchasePolicyBreakdown,
  caps: PurchaseCaps = defaultPurchaseCaps(),
): AnalysisFlag[] {
  const { maxLtcPct, maxArvLtvPct } = caps;
  const { costBasisCap, arvCap, policyMax, tier12AdvanceRule } = breakdown;
  if (arvCap === undefined) {
    return [];
  }

  const ctx = {
    costBasisCap,
    arvCap,
    policyMax,
    ...(breakdown.purchaseAdvanceRule && !tier12AdvanceRule
      ? {
          initialAdvancePct: breakdown.purchaseAdvanceRule.initialAdvancePct,
          rehabAdvancePct: breakdown.purchaseAdvanceRule.rehabAdvancePct,
          maxArvLtvPct: breakdown.purchaseAdvanceRule.maxArvLtvPct,
          purchaseTier: breakdown.purchaseTier,
        }
      : { maxLtcPct, maxArvLtvPct }),
    tier12AdvanceRule: tier12AdvanceRule === true,
  };

  const advanceRule = breakdown.purchaseAdvanceRule;
  const firstLegLabel = tier12AdvanceRule
    ? "advance-sum cap (90% of purchase + 100% of rehab)"
    : advanceRule
      ? `advance-sum cap (${advanceRule.initialAdvancePct * 100}% of purchase + ${advanceRule.rehabAdvancePct * 100}% of financed rehab)`
    : "LTC (cost-basis) cap";
  const secondLegLabel = tier12AdvanceRule
    ? "ARV cap (75% of ARV for tier 1–2)"
    : advanceRule
      ? `ARV cap (${advanceRule.maxArvLtvPct * 100}% of ARV for tier ${breakdown.purchaseTier})`
      : "ARV cap";

  if (approxEqualCents(costBasisCap, arvCap)) {
    return [
      {
        code: "PURCHASE_POLICY_MAX_BINDS_LTC",
        severity: "info",
        message: `Purchase policy maximum is limited by the ${firstLegLabel} rather than the ${secondLegLabel}.`,
        context: ctx,
      },
      {
        code: "PURCHASE_POLICY_MAX_BINDS_ARV",
        severity: "info",
        message: `Purchase policy maximum is limited by the ${secondLegLabel} rather than the ${firstLegLabel}.`,
        context: ctx,
      },
    ];
  }

  const flags: AnalysisFlag[] = [];

  if (
    approxEqualCents(policyMax, costBasisCap) &&
    costBasisCap < arvCap
  ) {
    flags.push({
      code: "PURCHASE_POLICY_MAX_BINDS_LTC",
      severity: "info",
      message: `Purchase policy maximum is limited by the ${firstLegLabel} rather than the ${secondLegLabel}.`,
      context: ctx,
    });
  }

  if (approxEqualCents(policyMax, arvCap) && arvCap < costBasisCap) {
    flags.push({
      code: "PURCHASE_POLICY_MAX_BINDS_ARV",
      severity: "info",
      message: `Purchase policy maximum is limited by the ${secondLegLabel} rather than the ${firstLegLabel}.`,
      context: ctx,
    });
  }

  return flags;
}
