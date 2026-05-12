import { and, count, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { documents, platformEvents, ruleSets } from "@/db/schema";
import type { AnalyticsStatus } from "./constants";
import { ANALYZE_TOOL_KEYS } from "./kpi-semantics";

/** Preset windows (days) for admin dashboard filters — query `?window=7` etc. */
export const DASHBOARD_WINDOW_PRESETS = [7, 30, 90, 180] as const;

export type DashboardWindowDays = (typeof DASHBOARD_WINDOW_PRESETS)[number];

const DEFAULT_WINDOW_DAYS: DashboardWindowDays = 7;
const MAX_WINDOW_DAYS = 366;
const DEFAULT_ADDRESS_LIST_LIMIT = 100;
const MAX_ADDRESS_LIST_LIMIT = 250;
const DASHBOARD_RECENT_EVENTS_LIMIT = 200;
/** Max distinct event_type series in stacked chart (remainder → `_other`). */
const DASHBOARD_STACK_MAX_EVENT_TYPES = 11;

export type DashboardAddressHit = {
  createdAtIso: string;
  address: string;
  role: string;
  status: AnalyticsStatus;
  /** Rural screening engine result when present */
  ruralResult?: string;
};

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
    /** `deal_analyze_run` + tool_key = term_sheet (Deal Sheet / Term Sheet builder preview). */
    termSheetPreviewRuns: number;
    /**
     * `term_sheet_generated` — emitted by POST /api/deal/terms only; reserved for a future
     * true generation/export path. Not used for the Term Sheet preview KPI (ANALYTICS-001A).
     */
    termSheetTermsApiEvents: number;
    documentUploads: number;
    documentPublishes: number;
    ruleSetUpdates: number;
    /** Successful `session_login` events (shared-password auth). */
    sessionLogins: number;
    propertyAnalyzeRuns: number;
    propertyValuationRuns: number;
    intelMarketRuns: number;
    intelBorrowerRuns: number;
    intelProspectRuns: number;
  };
  errorsInWindow: number;
  toolUsageByDay: { day: string; count: number }[];
  toolUsageByToolKey: { toolKey: string | null; count: number }[];
  publishedDocumentCount: number;
  publishedRuleSets: { ruleType: string; versionLabel: string }[];
  /** Success `deal_analyze_run` + term_sheet with non-empty `metadata.collateralPropertyAddress`. */
  termSheetCollateralAddresses: DashboardAddressHit[];
  /** Success `cash_to_close_run` with logged collateral address. */
  cashToCloseCollateralAddresses: DashboardAddressHit[];
  /** Rural checks with a logged `addressLine` (success or error). */
  ruralCheckAddresses: DashboardAddressHit[];
  /** Newest-first rows for the activity log (same window as KPIs). */
  recentEvents: DashboardRecentEvent[];
  /** Per-day counts by `event_type` for stacked chart (`_other` buckets long tail). */
  stackedUsageByDay: DashboardStackedDayRow[];
  /** Series keys aligned with `stackedUsageByDay[].counts` (includes `_other` when used). */
  chartStackKeys: string[];
};

export type DashboardRecentEvent = {
  id: string;
  createdAtIso: string;
  eventType: string;
  toolKey: string | null;
  role: string;
  route: string;
  status: AnalyticsStatus;
  metadataPreview: string;
};

export type DashboardStackedDayRow = {
  day: string;
  counts: Record<string, number>;
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
  sessionLogins: 0,
  propertyAnalyzeRuns: 0,
  propertyValuationRuns: 0,
  intelMarketRuns: 0,
  intelBorrowerRuns: 0,
  intelProspectRuns: 0,
};

function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function clampWindowDays(n: number): number {
  if (!Number.isFinite(n) || n < 1) {
    return DEFAULT_WINDOW_DAYS;
  }
  return Math.min(Math.floor(n), MAX_WINDOW_DAYS);
}

/**
 * Parses `?window=` for admin dashboard. Accepts preset days or any 1–366.
 */
export function parseDashboardWindowDays(raw: string | undefined): number {
  if (raw === undefined || raw === "") {
    return DEFAULT_WINDOW_DAYS;
  }
  const n = Number.parseInt(raw, 10);
  if (Number.isFinite(n) && (DASHBOARD_WINDOW_PRESETS as readonly number[]).includes(n)) {
    return n;
  }
  return clampWindowDays(n);
}

export type GetDashboardKpisOptions = {
  windowDays?: number;
  addressListLimit?: number;
};

const nonEmptyCollateralSql = sql`trim(coalesce(${platformEvents.metadata}->>'collateralPropertyAddress','')) <> ''`;

const nonEmptyRuralAddressSql = sql`trim(coalesce(${platformEvents.metadata}->>'addressLine','')) <> ''`;

function formatMetadataPreview(meta: unknown): string {
  if (meta === null || meta === undefined) {
    return "";
  }
  try {
    const s = JSON.stringify(meta);
    return s.length > 280 ? `${s.slice(0, 277)}...` : s;
  } catch {
    return "";
  }
}

export async function getDashboardKpis(
  options: GetDashboardKpisOptions = {},
): Promise<DashboardKpis> {
  const windowDays = clampWindowDays(options.windowDays ?? DEFAULT_WINDOW_DAYS);
  const addressListLimit = Math.min(
    Math.max(1, options.addressListLimit ?? DEFAULT_ADDRESS_LIST_LIMIT),
    MAX_ADDRESS_LIST_LIMIT,
  );

  const emptyLists = {
    termSheetCollateralAddresses: [] as DashboardAddressHit[],
    cashToCloseCollateralAddresses: [] as DashboardAddressHit[],
    ruralCheckAddresses: [] as DashboardAddressHit[],
  };

  try {
    const db = getDb();
    const since = new Date();
    since.setDate(since.getDate() - windowDays);

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
        eventType: platformEvents.eventType,
        toolKey: platformEvents.toolKey,
      })
      .from(platformEvents)
      .where(gte(platformEvents.createdAt, since));

    const byDay = new Map<string, number>();
    const byTool = new Map<string | null, number>();
    const eventTypeTotals = new Map<string, number>();
    const byDayAndEvent = new Map<string, Map<string, number>>();
    for (const r of windowRows) {
      const day = utcDay(new Date(r.createdAt));
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
      const tk = r.toolKey ?? null;
      byTool.set(tk, (byTool.get(tk) ?? 0) + 1);
      const et = r.eventType;
      eventTypeTotals.set(et, (eventTypeTotals.get(et) ?? 0) + 1);
      if (!byDayAndEvent.has(day)) {
        byDayAndEvent.set(day, new Map());
      }
      const dem = byDayAndEvent.get(day)!;
      dem.set(et, (dem.get(et) ?? 0) + 1);
    }

    const sortedEventTypes = [...eventTypeTotals.entries()].sort(
      (a, b) => b[1] - a[1],
    );
    const topEventTypes = sortedEventTypes
      .slice(0, DASHBOARD_STACK_MAX_EVENT_TYPES)
      .map(([k]) => k);
    const useOtherBucket = sortedEventTypes.length > topEventTypes.length;
    const chartStackKeys =
      topEventTypes.length === 0
        ? ([] as string[])
        : useOtherBucket
          ? [...topEventTypes, "_other"]
          : [...topEventTypes];

    const stackedUsageByDay: DashboardStackedDayRow[] = [];
    if (chartStackKeys.length > 0) {
      const sortedDays = [...byDayAndEvent.keys()].sort((a, b) =>
        a.localeCompare(b),
      );
      for (const day of sortedDays) {
        const dem = byDayAndEvent.get(day)!;
        const counts: Record<string, number> = {};
        for (const k of chartStackKeys) {
          if (k === "_other") {
            let other = 0;
            for (const [et, n] of dem) {
              if (!topEventTypes.includes(et)) {
                other += n;
              }
            }
            counts[k] = other;
          } else {
            counts[k] = dem.get(k) ?? 0;
          }
        }
        stackedUsageByDay.push({ day, counts });
      }
    }

    const toolUsageByDay = [...byDay.entries()]
      .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
      .slice(0, Math.min(60, windowDays + 5))
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

    const termSheetRows = await db
      .select({
        createdAt: platformEvents.createdAt,
        metadata: platformEvents.metadata,
        role: platformEvents.role,
        status: platformEvents.status,
      })
      .from(platformEvents)
      .where(
        and(
          gte(platformEvents.createdAt, since),
          eq(platformEvents.eventType, "deal_analyze_run"),
          eq(platformEvents.toolKey, ANALYZE_TOOL_KEYS.termSheetPreview),
          eq(platformEvents.status, "success"),
          nonEmptyCollateralSql,
        ),
      )
      .orderBy(desc(platformEvents.createdAt))
      .limit(addressListLimit);

    const ctcRows = await db
      .select({
        createdAt: platformEvents.createdAt,
        metadata: platformEvents.metadata,
        role: platformEvents.role,
        status: platformEvents.status,
      })
      .from(platformEvents)
      .where(
        and(
          gte(platformEvents.createdAt, since),
          eq(platformEvents.eventType, "cash_to_close_run"),
          inArray(platformEvents.toolKey, [
            ANALYZE_TOOL_KEYS.cashToCloseEstimator,
            "cash_to_close",
          ]),
          nonEmptyCollateralSql,
        ),
      )
      .orderBy(desc(platformEvents.createdAt))
      .limit(addressListLimit);

    const ruralRows = await db
      .select({
        createdAt: platformEvents.createdAt,
        metadata: platformEvents.metadata,
        role: platformEvents.role,
        status: platformEvents.status,
      })
      .from(platformEvents)
      .where(
        and(
          gte(platformEvents.createdAt, since),
          eq(platformEvents.eventType, "rural_check_run"),
          nonEmptyRuralAddressSql,
        ),
      )
      .orderBy(desc(platformEvents.createdAt))
      .limit(addressListLimit);

    const recentRows = await db
      .select({
        id: platformEvents.id,
        createdAt: platformEvents.createdAt,
        eventType: platformEvents.eventType,
        toolKey: platformEvents.toolKey,
        role: platformEvents.role,
        route: platformEvents.route,
        status: platformEvents.status,
        metadata: platformEvents.metadata,
      })
      .from(platformEvents)
      .where(gte(platformEvents.createdAt, since))
      .orderBy(desc(platformEvents.createdAt))
      .limit(DASHBOARD_RECENT_EVENTS_LIMIT);

    const recentEvents: DashboardRecentEvent[] = recentRows.map((r) => ({
      id: r.id,
      createdAtIso: new Date(r.createdAt).toISOString(),
      eventType: r.eventType,
      toolKey: r.toolKey ?? null,
      role: r.role,
      route: r.route,
      status: r.status as AnalyticsStatus,
      metadataPreview: formatMetadataPreview(r.metadata),
    }));

    function mapCollateralRows(
      rows: typeof termSheetRows,
    ): DashboardAddressHit[] {
      return rows.map((r) => {
        const meta = r.metadata as Record<string, unknown>;
        const addr =
          typeof meta.collateralPropertyAddress === "string"
            ? meta.collateralPropertyAddress.trim()
            : "";
        return {
          createdAtIso: new Date(r.createdAt).toISOString(),
          address: addr,
          role: r.role,
          status: r.status,
        };
      });
    }

    function mapRuralRows(rows: typeof ruralRows): DashboardAddressHit[] {
      return rows.map((r) => {
        const meta = r.metadata as Record<string, unknown>;
        const addr =
          typeof meta.addressLine === "string" ? meta.addressLine.trim() : "";
        const res = meta.result;
        return {
          createdAtIso: new Date(r.createdAt).toISOString(),
          address: addr,
          role: r.role,
          status: r.status,
          ruralResult: typeof res === "string" ? res : undefined,
        };
      });
    }

    async function tallyLoginSuccess(): Promise<number> {
      const [row] = await db
        .select({ c: count() })
        .from(platformEvents)
        .where(
          and(
            gte(platformEvents.createdAt, since),
            eq(platformEvents.eventType, "session_login"),
            eq(platformEvents.status, "success"),
          ),
        );
      return Number(row?.c ?? 0);
    }

    return {
      windowDays,
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
        sessionLogins: await tallyLoginSuccess(),
        propertyAnalyzeRuns: await tally("property_analyze_run"),
        propertyValuationRuns: await tally("property_valuation_run"),
        intelMarketRuns: await tally("intel_market_run"),
        intelBorrowerRuns: await tally("intel_borrower_run"),
        intelProspectRuns: await tally("intel_prospect_run"),
      },
      errorsInWindow,
      toolUsageByDay,
      toolUsageByToolKey,
      publishedDocumentCount: Number(pubDoc?.c ?? 0),
      publishedRuleSets: pubRules.map((r) => ({
        ruleType: r.ruleType,
        versionLabel: r.versionLabel,
      })),
      termSheetCollateralAddresses: mapCollateralRows(termSheetRows),
      cashToCloseCollateralAddresses: mapCollateralRows(ctcRows),
      ruralCheckAddresses: mapRuralRows(ruralRows),
      recentEvents,
      stackedUsageByDay,
      chartStackKeys,
    };
  } catch {
    return {
      windowDays,
      dbAvailable: false,
      totals: { ...emptyTotals },
      errorsInWindow: 0,
      toolUsageByDay: [],
      toolUsageByToolKey: [],
      publishedDocumentCount: 0,
      publishedRuleSets: [],
      recentEvents: [],
      stackedUsageByDay: [],
      chartStackKeys: [],
      ...emptyLists,
    };
  }
}
