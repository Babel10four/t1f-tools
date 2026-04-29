import { DEAL_ANALYZE_SCHEMA_VERSION } from "./deal-analyze-constants";
import type { DealPurpose } from "./deal-analyze-constants";
import type { DealAnalyzeProgramContextV1 } from "./deal-program-context";

export type { DealPurpose } from "./deal-analyze-constants";

/**
 * Canonical `deal` slice after normalization (numbers only; `rehabBudget` default 0).
 * No undocumented public fields.
 */
export type DealAnalyzeDealV1 = {
  purpose: DealPurpose;
  productType: string;
  purchasePrice?: number;
  payoffAmount?: number;
  requestedLoanAmount?: number;
  rehabBudget: number;
  termMonths: number | null;
};

export type DealAnalyzePropertyV1 = {
  arv?: number;
  asIsValue?: number;
};

export type DealAnalyzeBorrowerV1 = {
  fico?: number;
  experienceTier?: string;
};

/** Normalized request consumed by `runDealAnalyze` (validators + engine). */
export type DealAnalyzeRequestV1 = {
  schemaVersion: typeof DEAL_ANALYZE_SCHEMA_VERSION;
  deal: DealAnalyzeDealV1;
  property?: DealAnalyzePropertyV1;
  borrower?: DealAnalyzeBorrowerV1;
  /** Optional opaque bag; not expanded in v1. */
  assumptions?: Record<string, unknown>;
  /**
   * Optional underwriting/program context (POLICY-ENGINE-REWRITE Phase B).
   * Validators reject unknown keys here and on other canonical slices.
   */
  programContext?: DealAnalyzeProgramContextV1;
};
