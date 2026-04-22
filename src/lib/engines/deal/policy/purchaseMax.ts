import type { DealAnalyzeRequestV1 } from "../schemas/canonical-request";
import type { AnalysisFlag } from "../schemas/canonical-response";
import { isBorrowerTier1Or2 } from "./borrowerTier";
import {
  POLICY_MAX_ARV_LTV_PCT,
  POLICY_MAX_LTC_PCT,
  TIER12_INITIAL_ADVANCE_PCT,
  TIER12_MAX_ARV_LTV_PCT,
  TIER12_REHAB_ADVANCE_PCT,
} from "./constants";

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
};

/**
 * Purchase policy maximum loan before recommended-amount clamp.
 * ARV leg omitted when `arv` missing or ≤ 0 (cost basis only).
 */
export function purchasePolicyBreakdown(
  req: DealAnalyzeRequestV1,
  caps: { maxLtcPct: number; maxArvLtvPct: number } = defaultPurchaseCaps(),
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
  if (tier12) {
    const sumAdvanceCap = money(
      TIER12_INITIAL_ADVANCE_PCT * purchasePrice +
        TIER12_REHAB_ADVANCE_PCT * rehab,
    );
    const arv = property?.arv;
    if (arv !== undefined && typeof arv === "number" && arv > 0) {
      const arvCap = money(TIER12_MAX_ARV_LTV_PCT * arv);
      const policyMax = money(Math.min(sumAdvanceCap, arvCap));
      return {
        basis,
        costBasisCap: sumAdvanceCap,
        ltcCap: sumAdvanceCap,
        arvCap,
        policyMax,
        tier12AdvanceRule: true,
      };
    }
    return {
      basis,
      costBasisCap: sumAdvanceCap,
      ltcCap: sumAdvanceCap,
      arvCap: undefined,
      policyMax: sumAdvanceCap,
      tier12AdvanceRule: true,
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
  caps: { maxLtcPct: number; maxArvLtvPct: number } = defaultPurchaseCaps(),
): number | undefined {
  return purchasePolicyBreakdown(req, caps)?.policyMax;
}

/**
 * TICKET-002A: diagnostic flags when both ARV and cost-basis legs apply.
 * No flags when only one leg (no positive ARV).
 */
export function purchaseBindingFlags(
  breakdown: PurchasePolicyBreakdown,
  caps: { maxLtcPct: number; maxArvLtvPct: number } = defaultPurchaseCaps(),
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
    maxLtcPct,
    maxArvLtvPct,
    tier12AdvanceRule: tier12AdvanceRule === true,
  };

  const firstLegLabel = tier12AdvanceRule
    ? "advance-sum cap (90% of purchase + 100% of rehab)"
    : "LTC (cost-basis) cap";
  const secondLegLabel = tier12AdvanceRule
    ? "ARV cap (75% of ARV for tier 1–2)"
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
