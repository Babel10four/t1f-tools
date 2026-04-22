/**
 * Frozen vocabulary for Deal Engine v1 — Builder must not invent alternatives.
 * @see docs/specs/TICKET-002.md
 * @see docs/specs/TICKET-002A.md
 * @see docs/business-rules/deal-engine-v1-assumptions.md
 */

/** Known `analysis.flags[].code` values (diagnostic / normalization). */
export const DEAL_ANALYZE_KNOWN_FLAG_CODES = [
  "PURCHASE_POLICY_MAX_BINDS_LTC",
  "PURCHASE_POLICY_MAX_BINDS_ARV",
  /** POLICY-ADOPTION-001A — embedded default policy when published rule_sets unavailable. */
  "POLICY_CONFIG_FALLBACK",
] as const;

export type DealAnalyzeKnownFlagCode =
  (typeof DEAL_ANALYZE_KNOWN_FLAG_CODES)[number];

/** Supported v1 programs: exact `deal.productType` literals (with matching `deal.purpose`). */
export const V1_SUPPORTED_PRODUCT_TYPE = {
  purchase: "bridge_purchase",
  refinance: "bridge_refinance",
} as const;

export type V1SupportedProductType =
  (typeof V1_SUPPORTED_PRODUCT_TYPE)[keyof typeof V1_SUPPORTED_PRODUCT_TYPE];

/** `pricing.status` and `cashToClose.status` share this frozen union. */
export const DEAL_ANALYZE_PRICING_STATUS_VALUES = [
  "stub",
  "complete",
  "indicative",
  "insufficient_inputs",
  "needs_review",
] as const;

export type DealAnalyzePricingStatus =
  (typeof DEAL_ANALYZE_PRICING_STATUS_VALUES)[number];

export type DealAnalyzeCashToCloseStatus = DealAnalyzePricingStatus;

/** Stable `risks[].code` values — extend only via spec + business-rules revision. */
export const DEAL_ANALYZE_STABLE_RISK_CODES = [
  "REQUEST_EXCEEDS_POLICY_MAX",
  "LTV_OVER_LIMIT",
  "LTC_OVER_LIMIT",
  "MISSING_COLLATERAL_VALUE",
  "MISSING_BORROWER_PRICING_INPUT",
  "UNSUPPORTED_PRODUCT_V1",
  "VALUE_BASIS_ASSUMED",
  "TERM_OUT_OF_RANGE",
] as const;

export type DealAnalyzeStableRiskCode =
  (typeof DEAL_ANALYZE_STABLE_RISK_CODES)[number];
