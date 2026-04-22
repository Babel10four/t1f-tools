import { describe, expect, it } from "vitest";
import { ANALYZE_TOOL_KEYS } from "./kpi-semantics";
import { resolveAnalyzeAnalyticsContext } from "./resolve-analyze-context";

describe("resolveAnalyzeAnalyticsContext", () => {
  it("maps canonical and legacy headers to stored tool_key", () => {
    expect(resolveAnalyzeAnalyticsContext("loan_structuring_assistant")).toEqual({
      toolKey: ANALYZE_TOOL_KEYS.loanStructuringAssistant,
      eventType: "deal_analyze_run",
    });
    expect(resolveAnalyzeAnalyticsContext("loan_structuring")).toEqual({
      toolKey: ANALYZE_TOOL_KEYS.loanStructuringAssistant,
      eventType: "deal_analyze_run",
    });
    expect(resolveAnalyzeAnalyticsContext("pricing_calculator")).toEqual({
      toolKey: ANALYZE_TOOL_KEYS.pricingCalculator,
      eventType: "pricing_check_run",
    });
    expect(resolveAnalyzeAnalyticsContext("cash_to_close_estimator")).toEqual({
      toolKey: ANALYZE_TOOL_KEYS.cashToCloseEstimator,
      eventType: "cash_to_close_run",
    });
    expect(resolveAnalyzeAnalyticsContext("cash_to_close")).toEqual({
      toolKey: ANALYZE_TOOL_KEYS.cashToCloseEstimator,
      eventType: "cash_to_close_run",
    });
    expect(resolveAnalyzeAnalyticsContext("term_sheet")).toEqual({
      toolKey: ANALYZE_TOOL_KEYS.termSheetPreview,
      eventType: "deal_analyze_run",
    });
  });

  it("uses deal_analyze_run for unknown keys with raw tool_key", () => {
    expect(resolveAnalyzeAnalyticsContext("custom_tool")).toEqual({
      toolKey: "custom_tool",
      eventType: "deal_analyze_run",
    });
  });
});
