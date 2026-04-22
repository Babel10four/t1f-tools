/**
 * ANALYTICS-001 — explicit event taxonomy (no vague catch-all types).
 * `tool_key` aligns with spec examples; optional headers use these values.
 */
export const ANALYTICS_EVENT_TYPES = [
  "deal_analyze_run",
  "term_sheet_generated",
  "pricing_check_run",
  "cash_to_close_run",
  "rural_check_run",
  "credit_copilot_question",
  /** Voice harness — not Credit Copilot (TICKET-009A). */
  "voice_session_run",
  "document_uploaded",
  "document_published",
  "rule_set_updated",
] as const;

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

/** Suggested tool_key values (spec + internal harness; canonical analyze keys in kpi-semantics). */
export const ANALYTICS_TOOL_KEYS = [
  "loan_structuring_assistant",
  "pricing_calculator",
  "cash_to_close_estimator",
  "term_sheet",
  "rural",
  "rural_checker",
  "credit_copilot",
  /** Voice session API — not Credit Copilot (TICKET-009A). */
  "voice_operator",
  "deal_analyzer",
] as const;

export type AnalyticsToolKey = (typeof ANALYTICS_TOOL_KEYS)[number];

/** Clients send this header on POST /api/deal/analyze to disambiguate KPIs (body unchanged). */
export const ANALYTICS_TOOL_KEY_HEADER = "x-t1f-tool-key";

export const ANALYTICS_STATUS = ["success", "error"] as const;
export type AnalyticsStatus = (typeof ANALYTICS_STATUS)[number];

/** Max JSON metadata size (chars) stored server-side — keeps rows bounded. */
export const ANALYTICS_METADATA_MAX_CHARS = 12_000;
