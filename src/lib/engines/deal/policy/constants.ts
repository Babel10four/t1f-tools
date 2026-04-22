/**
 * Numeric policy caps — must match `docs/business-rules/deal-engine-v1-assumptions.md`
 * until capital signs final numbers.
 */
export const POLICY_MAX_LTC_PCT = 0.75;
export const POLICY_MAX_ARV_LTV_PCT = 0.7;

/** Tier 1 & 2 bridge purchase: 90% of purchase + 100% of rehab, capped by ARV (see business rules). */
export const TIER12_INITIAL_ADVANCE_PCT = 0.9;
export const TIER12_REHAB_ADVANCE_PCT = 1.0;
export const TIER12_MAX_ARV_LTV_PCT = 0.75;
export const POLICY_REFINANCE_MAX_LTV_PCT = 0.75;
export const POLICY_DEFAULT_TERM_MONTHS = 12;

/** LTV percent above which `LTV_OVER_LIMIT` applies (same scale as `loan.ltv`: 0–100). */
export const POLICY_LTV_OVER_LIMIT_THRESHOLD_PCT = 75;

/** Cash-to-close illustrative multipliers (fraction of reference amount) — POLICY-ADOPTION-001. */
export const POLICY_CTC_POINTS_PCT = 0.005;
export const POLICY_CTC_LENDER_FEES_PCT = 0.01;
export const POLICY_CTC_CLOSING_COSTS_PCT = 0.015;
