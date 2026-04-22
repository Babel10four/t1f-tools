/** Frozen public contract version for POST /api/deal/analyze. */
export const DEAL_ANALYZE_SCHEMA_VERSION = "deal_analyze.v1";

/** Documented purchase vs refinance discriminator. */
export const DEAL_PURPOSES = ["purchase", "refinance"] as const;
export type DealPurpose = (typeof DEAL_PURPOSES)[number];
