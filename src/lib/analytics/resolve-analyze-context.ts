import type { AnalyticsEventType } from "./constants";
import { ANALYZE_TOOL_KEYS } from "./kpi-semantics";

export type AnalyzeAnalyticsContext = {
  toolKey: string;
  eventType: AnalyticsEventType;
};

/**
 * Maps optional `X-T1F-Tool-Key` on POST /api/deal/analyze to KPI event_type + tool_key.
 * Legacy short keys (`loan_structuring`, `cash_to_close`) normalize to canonical stored keys
 * so dashboard KPIs stay stable (ANALYTICS-001A).
 */
export function resolveAnalyzeAnalyticsContext(
  headerValue: string | null,
): AnalyzeAnalyticsContext {
  const raw = headerValue?.trim().toLowerCase() ?? "";
  switch (raw) {
    case "loan_structuring":
    case "loan_structuring_assistant":
      return {
        toolKey: ANALYZE_TOOL_KEYS.loanStructuringAssistant,
        eventType: "deal_analyze_run",
      };
    case "pricing_calculator":
      return {
        toolKey: ANALYZE_TOOL_KEYS.pricingCalculator,
        eventType: "pricing_check_run",
      };
    case "cash_to_close":
    case "cash_to_close_estimator":
      return {
        toolKey: ANALYZE_TOOL_KEYS.cashToCloseEstimator,
        eventType: "cash_to_close_run",
      };
    case "term_sheet":
      return {
        toolKey: ANALYZE_TOOL_KEYS.termSheetPreview,
        eventType: "deal_analyze_run",
      };
    case "deal_analyzer":
      return {
        toolKey: ANALYZE_TOOL_KEYS.dealAnalyzer,
        eventType: "deal_analyze_run",
      };
    default:
      return {
        toolKey: raw.length > 0 ? raw : "unknown",
        eventType: "deal_analyze_run",
      };
  }
}
