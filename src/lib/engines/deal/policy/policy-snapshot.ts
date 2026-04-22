/**
 * Typed policy snapshot for deal analysis — from published rule_sets (CONTENT-002) or embedded fallback.
 * @see docs/specs/POLICY-ADOPTION-001.md
 */
import type { RatesPayload } from "@/lib/rule-sets/validate-payload";
import type { BindingTypeV1 } from "@/db/schema";
import {
  POLICY_CTC_CLOSING_COSTS_PCT,
  POLICY_CTC_LENDER_FEES_PCT,
  POLICY_CTC_POINTS_PCT,
  POLICY_DEFAULT_TERM_MONTHS,
  POLICY_LTV_OVER_LIMIT_THRESHOLD_PCT,
  POLICY_MAX_ARV_LTV_PCT,
  POLICY_MAX_LTC_PCT,
  POLICY_REFINANCE_MAX_LTV_PCT,
} from "./constants";

/** Shared engine policy — not UI tool keys (POLICY-ADOPTION-001 amendment). */
export const DEAL_ENGINE_TOOL_KEY = "deal_engine" as const;

export const DEAL_ENGINE_BINDING_RATES: BindingTypeV1 = "rates_rule_set";
export const DEAL_ENGINE_BINDING_CALCULATOR: BindingTypeV1 =
  "calculator_assumptions_rule_set";

/** Calculator assumption keys in `calculator_assumptions.assumptions` (all required when published). */
export const CALCULATOR_ASSUMPTION_KEYS = [
  "maxLtcPct",
  "maxArvLtvPct",
  "refinanceMaxLtvPct",
  "defaultTermMonths",
  "ltvOverLimitThresholdPct",
  "ctcPointsPct",
  "ctcLenderFeesPct",
  "ctcClosingCostsPct",
] as const;

export type DealAnalyzeCalculatorSlice = {
  maxLtcPct: number;
  maxArvLtvPct: number;
  refinanceMaxLtvPct: number;
  defaultTermMonths: number;
  /** Same scale as `loan.ltv` (0–100). */
  ltvOverLimitThresholdPct: number;
  ctcPointsPct: number;
  ctcLenderFeesPct: number;
  ctcClosingCostsPct: number;
};

export type DealAnalyzeRatesSlice = {
  noteRatePercent: number | null;
  marginBps: number | null;
  discountPoints: number | null;
  lockDays: number | null;
};

export type DealAnalyzePolicySnapshot = {
  source: "published" | "fallback";
  calculator: DealAnalyzeCalculatorSlice;
  /** Null pricing fields when no rates config or full fallback. */
  rates: DealAnalyzeRatesSlice | null;
};

function isFinitePositive(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}

/**
 * Parse `calculator_assumptions.assumptions` into a calculator slice.
 * Returns null if any required key is missing or out of range.
 */
export function parseCalculatorAssumptionsRecord(
  assumptions: Record<string, number>,
): DealAnalyzeCalculatorSlice | null {
  for (const key of CALCULATOR_ASSUMPTION_KEYS) {
    if (!(key in assumptions) || !Number.isFinite(assumptions[key])) {
      return null;
    }
  }
  const maxLtcPct = assumptions.maxLtcPct;
  const maxArvLtvPct = assumptions.maxArvLtvPct;
  const refinanceMaxLtvPct = assumptions.refinanceMaxLtvPct;
  const defaultTermMonths = assumptions.defaultTermMonths;
  const ltvOverLimitThresholdPct = assumptions.ltvOverLimitThresholdPct;
  const ctcPointsPct = assumptions.ctcPointsPct;
  const ctcLenderFeesPct = assumptions.ctcLenderFeesPct;
  const ctcClosingCostsPct = assumptions.ctcClosingCostsPct;

  if (
    maxLtcPct <= 0 ||
    maxLtcPct > 1 ||
    maxArvLtvPct <= 0 ||
    maxArvLtvPct > 1 ||
    refinanceMaxLtvPct <= 0 ||
    refinanceMaxLtvPct > 1
  ) {
    return null;
  }
  if (
    !Number.isInteger(defaultTermMonths) ||
    defaultTermMonths < 1 ||
    defaultTermMonths > 600
  ) {
    return null;
  }
  if (
    ltvOverLimitThresholdPct <= 0 ||
    ltvOverLimitThresholdPct > 100
  ) {
    return null;
  }
  if (
    !isFinitePositive(ctcPointsPct) ||
    !isFinitePositive(ctcLenderFeesPct) ||
    !isFinitePositive(ctcClosingCostsPct) ||
    ctcPointsPct > 1 ||
    ctcLenderFeesPct > 1 ||
    ctcClosingCostsPct > 1
  ) {
    return null;
  }

  return {
    maxLtcPct,
    maxArvLtvPct,
    refinanceMaxLtvPct,
    defaultTermMonths,
    ltvOverLimitThresholdPct,
    ctcPointsPct,
    ctcLenderFeesPct,
    ctcClosingCostsPct,
  };
}

export function getFallbackPolicySnapshot(): DealAnalyzePolicySnapshot {
  return {
    source: "fallback",
    calculator: {
      maxLtcPct: POLICY_MAX_LTC_PCT,
      maxArvLtvPct: POLICY_MAX_ARV_LTV_PCT,
      refinanceMaxLtvPct: POLICY_REFINANCE_MAX_LTV_PCT,
      defaultTermMonths: POLICY_DEFAULT_TERM_MONTHS,
      ltvOverLimitThresholdPct: POLICY_LTV_OVER_LIMIT_THRESHOLD_PCT,
      ctcPointsPct: POLICY_CTC_POINTS_PCT,
      ctcLenderFeesPct: POLICY_CTC_LENDER_FEES_PCT,
      ctcClosingCostsPct: POLICY_CTC_CLOSING_COSTS_PCT,
    },
    rates: null,
  };
}

/** Map validated `rates` JSON to pricing fields (nulls for omitted keys). */
export function extractDealEngineRatesFromPayload(
  payload: RatesPayload,
): DealAnalyzeRatesSlice {
  return {
    noteRatePercent: payload.noteRatePercent ?? null,
    marginBps: payload.marginBps ?? null,
    discountPoints: payload.discountPoints ?? null,
    lockDays: payload.lockDays ?? null,
  };
}
