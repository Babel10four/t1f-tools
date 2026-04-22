import { describe, expect, it } from "vitest";
import {
  ANALYZE_TOOL_KEYS,
  isCashToCloseKpiEvent,
  isDealAnalyzerKpiEvent,
  isLoanStructuringAssistantKpiEvent,
  isPricingKpiEvent,
  isTermSheetPreviewKpiEvent,
} from "./kpi-semantics";

describe("ANALYTICS-001A KPI predicates (deal_analyze_run + tool_key)", () => {
  it("term_sheet → only Term Sheet preview KPI", () => {
    const row = {
      eventType: "deal_analyze_run",
      toolKey: ANALYZE_TOOL_KEYS.termSheetPreview,
    };
    expect(isTermSheetPreviewKpiEvent(row)).toBe(true);
    expect(isDealAnalyzerKpiEvent(row)).toBe(false);
    expect(isLoanStructuringAssistantKpiEvent(row)).toBe(false);
  });

  it("deal_analyzer → only Deal Analyzer KPI", () => {
    const row = {
      eventType: "deal_analyze_run",
      toolKey: ANALYZE_TOOL_KEYS.dealAnalyzer,
    };
    expect(isDealAnalyzerKpiEvent(row)).toBe(true);
    expect(isTermSheetPreviewKpiEvent(row)).toBe(false);
    expect(isLoanStructuringAssistantKpiEvent(row)).toBe(false);
  });

  it("loan_structuring_assistant → only LSA KPI", () => {
    const row = {
      eventType: "deal_analyze_run",
      toolKey: ANALYZE_TOOL_KEYS.loanStructuringAssistant,
    };
    expect(isLoanStructuringAssistantKpiEvent(row)).toBe(true);
    expect(isDealAnalyzerKpiEvent(row)).toBe(false);
    expect(isPricingKpiEvent(row)).toBe(false);
  });

  it("pricing_calculator → only Pricing KPI", () => {
    const row = {
      eventType: "pricing_check_run",
      toolKey: ANALYZE_TOOL_KEYS.pricingCalculator,
    };
    expect(isPricingKpiEvent(row)).toBe(true);
    expect(isCashToCloseKpiEvent(row)).toBe(false);
  });

  it("cash_to_close_estimator → only Cash KPI", () => {
    const row = {
      eventType: "cash_to_close_run",
      toolKey: ANALYZE_TOOL_KEYS.cashToCloseEstimator,
    };
    expect(isCashToCloseKpiEvent(row)).toBe(true);
    expect(isPricingKpiEvent(row)).toBe(false);
  });

  it("term_sheet_generated event type does not satisfy preview predicate", () => {
    expect(
      isTermSheetPreviewKpiEvent({
        eventType: "term_sheet_generated",
        toolKey: "term_sheet",
      }),
    ).toBe(false);
  });
});
