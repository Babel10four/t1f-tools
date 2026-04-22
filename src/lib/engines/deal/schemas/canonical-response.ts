import { DEAL_ANALYZE_SCHEMA_VERSION } from "./deal-analyze-constants";
import type { DealPurpose } from "./deal-analyze-constants";
import type {
  DealAnalyzeCashToCloseStatus,
  DealAnalyzePricingStatus,
} from "./deal-engine-v1-enums";

export type AnalysisFlag = {
  code: string;
  severity: "info" | "low" | "medium" | "high";
  message: string;
  context?: Record<string, unknown>;
};

export type DealAnalyzeRiskV1 = {
  code: string;
  severity: "info" | "low" | "medium" | "high";
  title: string;
  /** Structured detail (v1 stub narrative). */
  detail: string;
};

/**
 * Loan output: normalized echoes + metrics actually computed in v1 only.
 *
 * **`loan.amount`** (TICKET-002 nested extension): policy-backed **recommended** loan
 * amount — **not** renamed to `recommendedAmount`. Semantics:
 * - If `deal.requestedLoanAmount` exists → `min(requestedLoanAmount, policyMax)`
 * - Else → `policyMax`
 * Omit **`amount`** when policy max is undefined (e.g. unsupported product or
 * indeterminate refinance basis) — never fabricate a number.
 */
export type DealAnalyzeLoanOutV1 = {
  purpose: DealPurpose;
  productType: string;
  termMonths: number | null;
  rehabBudget: number;
  purchasePrice?: number;
  payoffAmount?: number;
  requestedLoanAmount?: number;
  /** Policy-backed recommended amount (see module doc above). */
  amount?: number;
  /**
   * LTV in **0–100 percent** (e.g. `75` = 75%), **not** a 0–1 ratio.
   * @see docs/business-rules/deal-engine-v1-assumptions.md
   */
  ltv?: number;
  /**
   * Loan-to-cost: total loan ÷ cost basis in **0–100 percent** (same scale as `ltv`).
   * Purchase basis: purchase price + rehab. Refinance: payoff + rehab.
   */
  ltcPercent?: number;
  /** Portion of `amount` attributed to acquisition / initial advance (v1 structuring split). */
  acquisitionLoanAmount?: number;
  /** Portion of `amount` attributed to rehab (v1 structuring split). */
  rehabLoanAmount?: number;
  /** Echo from `assumptions.originationPointsPercent` when provided (percent points, e.g. 0.65). */
  originationPointsPercent?: number;
  /** Echo from `assumptions.originationFlatFee` when provided. */
  originationFlatFee?: number;
};

export type DealAnalyzePricingOutV1 = {
  status: DealAnalyzePricingStatus;
  noteRatePercent: number | null;
  marginBps: number | null;
  discountPoints: number | null;
  lockDays: number | null;
};

export type DealAnalyzeCashLineV1 = {
  label: string;
  amount: number;
};

export type DealAnalyzeCashToCloseOutV1 = {
  status: DealAnalyzeCashToCloseStatus;
  estimatedTotal: number | null;
  items: DealAnalyzeCashLineV1[];
};

/** 200 JSON body for POST /api/deal/analyze. */
export type DealAnalyzeResponseV1 = {
  schemaVersion: typeof DEAL_ANALYZE_SCHEMA_VERSION;
  analysis: {
    status: "complete" | "incomplete";
    flags: AnalysisFlag[];
  };
  loan: DealAnalyzeLoanOutV1;
  pricing: DealAnalyzePricingOutV1;
  cashToClose: DealAnalyzeCashToCloseOutV1;
  risks: DealAnalyzeRiskV1[];
};
