/**
 * ANALYTICS-001A — single source of truth for which rows feed which dashboard KPIs.
 * Analyze-backed tools: `event_type = deal_analyze_run` + `tool_key` (see README).
 */

/** Stored `tool_key` for POST /api/deal/analyze when X-T1F-Tool-Key matches. */
export const ANALYZE_TOOL_KEYS = {
  /** Deal Structuring Copilot / loan_structuring_assistant (rep-facing UI). */
  loanStructuringAssistant: "loan_structuring_assistant",
  /** Internal JSON harness at /tools/deal-analyzer. */
  dealAnalyzer: "deal_analyzer",
  /** Term Sheet preview (TICKET-007 — analyze → HTML only, not PDF export). */
  termSheetPreview: "term_sheet",
  pricingCalculator: "pricing_calculator",
  cashToCloseEstimator: "cash_to_close_estimator",
} as const;

export type AnalyzeToolKey =
  (typeof ANALYZE_TOOL_KEYS)[keyof typeof ANALYZE_TOOL_KEYS];

/** Rows that count toward the “Term Sheet preview runs” KPI. */
export function isTermSheetPreviewKpiEvent(e: {
  eventType: string;
  toolKey: string | null;
}): boolean {
  return (
    e.eventType === "deal_analyze_run" &&
    e.toolKey === ANALYZE_TOOL_KEYS.termSheetPreview
  );
}

export function isDealAnalyzerKpiEvent(e: {
  eventType: string;
  toolKey: string | null;
}): boolean {
  return (
    e.eventType === "deal_analyze_run" &&
    e.toolKey === ANALYZE_TOOL_KEYS.dealAnalyzer
  );
}

export function isLoanStructuringAssistantKpiEvent(e: {
  eventType: string;
  toolKey: string | null;
}): boolean {
  return (
    e.eventType === "deal_analyze_run" &&
    e.toolKey === ANALYZE_TOOL_KEYS.loanStructuringAssistant
  );
}

export function isPricingKpiEvent(e: {
  eventType: string;
  toolKey: string | null;
}): boolean {
  return (
    e.eventType === "pricing_check_run" &&
    e.toolKey === ANALYZE_TOOL_KEYS.pricingCalculator
  );
}

export function isCashToCloseKpiEvent(e: {
  eventType: string;
  toolKey: string | null;
}): boolean {
  return (
    e.eventType === "cash_to_close_run" &&
    e.toolKey === ANALYZE_TOOL_KEYS.cashToCloseEstimator
  );
}
