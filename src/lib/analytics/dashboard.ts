import { and, count, desc, eq, gte, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { documents, platformEvents, ruleSets } from "@/db/schema";
import { ANALYZE_TOOL_KEYS } from "./kpi-semantics";

const WINDOW_DAYS = 7;

export type DashboardKpis = {
  windowDays: number;
  dbAvailable: boolean;
  totals: {
    /** `deal_analyze_run` + tool_key = loan_structuring_assistant */
    loanStructuringAssistantRuns: number;
    /** `deal_analyze_run` + tool_key = deal_analyzer */
    dealAnalyzerRuns: number;
    /** `pricing_check_run` + tool_key = pricing_calculator */
    pricingCheckRuns: number;
    /** `cash_to_close_run` + tool_key = cash_to_close_estimator */
    cashToCloseRuns: number;
    ruralCheckRuns: number;
    creditCopilotQuestions: number;
    /** `deal_analyze_run` + tool_key = term_sheet (preview-only UI). */
    termSheetPreviewRuns: number;
    /**
     * `term_sheet_generated` — emitted by POST /api/deal/terms only; reserved for a future
     * true generation/export path. Not used for the Term Sheet preview KPI (ANALYTICS-001A).
     */
    termSheetTermsApiEvents: number;
    documentUploads: number;
    documentPublishes: number;
    ruleSetUpdates: number;
  };
  errorsInWindow: number;
  toolUsageByDay: { day: string; count: number }[];
  toolUsageByToolKey: { toolKey: string | null; count: number }[];
  publishedDocumentCount: number;
  publishedRuleSets: { ruleType: string; versionLabel: string }[];
};

const emptyTotals: DashboardKpis["totals"] = {
  loanStructuringAssistantRuns: 0,
  dealAnalyzerRuns: 0,
  pricingCheckRuns: 0,
  cashToCloseRuns: 0,
  ruralCheckRuns: 0,
  creditCopilotQuestions: 0,
  termSheetPreviewRuns: 0,
  termSheetTermsApiEvents: 0,
  documentUploads: 0,
  documentPublishes: 0,
  ruleSetUpdates: 0,
};

function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function getDashboardKpis(): Promise<DashboardKpis> {
  try {
    const db = getDb();
    const since = new Date();
    since.setDate(since.getDate() - WINDOW_DAYS);

    async function tally(eventType: string): Promise<number> {
      const [row] = await db
        .select({ c: count() })
        .from(platformEvents)
        .where(
          and(
            gte(platformEvents.createdAt, since),
            eq(platformEvents.eventType, eventType),
          ),
        );
      return Number(row?.c ?? 0);
    }

    async function tallyTypedTool(
      eventType: string,
      toolKey: string,
    ): Promise<number> {
      const [row] = await db
        .select({ c: count() })
        .from(platformEvents)
        .where(
          and(
            gte(platformEvents.createdAt, since),
            eq(platformEvents.eventType, eventType),
            eq(platformEvents.toolKey, toolKey),
          ),
        );
      return Number(row?.c ?? 0);
    }

    /** Same KPI, pre-001A `tool_key` stored on older rows. */
    async function tallyTypedToolLegacy(
      eventType: string,
      canonicalKey: string,
      legacyKey: string,
    ): Promise<number> {
      const [row] = await db
        .select({ c: count() })
        .from(platformEvents)
        .where(
          and(
            gte(platformEvents.createdAt, since),
            eq(platformEvents.eventType, eventType),
            inArray(platformEvents.toolKey, [canonicalKey, legacyKey]),
          ),
        );
      return Number(row?.c ?? 0);
    }

    const [errRow] = await db
      .select({ c: count() })
      .from(platformEvents)
      .where(
        and(
          gte(platformEvents.createdAt, since),
          eq(platformEvents.status, "error"),
        ),
      );
    const errorsInWindow = Number(errRow?.c ?? 0);

    const windowRows = await db
      .select({
        createdAt: platformEvents.createdAt,
        toolKey: platformEvents.toolKey,
      })
      .from(platformEvents)
      .where(gte(platformEvents.createdAt, since));

    const byDay = new Map<string, number>();
    const byTool = new Map<string | null, number>();
    for (const r of windowRows) {
      const day = utcDay(new Date(r.createdAt));
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
      const tk = r.toolKey ?? null;
      byTool.set(tk, (byTool.get(tk) ?? 0) + 1);
    }

    const toolUsageByDay = [...byDay.entries()]
      .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
      .slice(0, 14)
      .map(([day, c]) => ({ day, count: c }));

    const toolUsageByToolKey = [...byTool.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .map(([toolKey, c]) => ({ toolKey, count: c }));

    const [pubDoc] = await db
      .select({ c: count() })
      .from(documents)
      .where(eq(documents.status, "published"));

    const pubRules = await db
      .select({
        ruleType: ruleSets.ruleType,
        versionLabel: ruleSets.versionLabel,
      })
      .from(ruleSets)
      .where(eq(ruleSets.status, "published"))
      .orderBy(desc(ruleSets.publishedAt));

    return {
      windowDays: WINDOW_DAYS,
      dbAvailable: true,
      totals: {
        loanStructuringAssistantRuns: await tallyTypedToolLegacy(
          "deal_analyze_run",
          ANALYZE_TOOL_KEYS.loanStructuringAssistant,
          "loan_structuring",
        ),
        dealAnalyzerRuns: await tallyTypedTool(
          "deal_analyze_run",
          ANALYZE_TOOL_KEYS.dealAnalyzer,
        ),
        pricingCheckRuns: await tallyTypedTool(
          "pricing_check_run",
          ANALYZE_TOOL_KEYS.pricingCalculator,
        ),
        cashToCloseRuns: await tallyTypedToolLegacy(
          "cash_to_close_run",
          ANALYZE_TOOL_KEYS.cashToCloseEstimator,
          "cash_to_close",
        ),
        ruralCheckRuns: await tally("rural_check_run"),
        creditCopilotQuestions: await tally("credit_copilot_question"),
        termSheetPreviewRuns: await tallyTypedTool(
          "deal_analyze_run",
          ANALYZE_TOOL_KEYS.termSheetPreview,
        ),
        termSheetTermsApiEvents: await tally("term_sheet_generated"),
        documentUploads: await tally("document_uploaded"),
        documentPublishes: await tally("document_published"),
        ruleSetUpdates: await tally("rule_set_updated"),
      },
      errorsInWindow,
      toolUsageByDay,
      toolUsageByToolKey,
      publishedDocumentCount: Number(pubDoc?.c ?? 0),
      publishedRuleSets: pubRules.map((r) => ({
        ruleType: r.ruleType,
        versionLabel: r.versionLabel,
      })),
    };
  } catch {
    return {
      windowDays: WINDOW_DAYS,
      dbAvailable: false,
      totals: { ...emptyTotals },
      errorsInWindow: 0,
      toolUsageByDay: [],
      toolUsageByToolKey: [],
      publishedDocumentCount: 0,
      publishedRuleSets: [],
    };
  }
}
