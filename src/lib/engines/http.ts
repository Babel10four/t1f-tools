import {
  ANALYTICS_TOOL_KEY_HEADER,
  type AnalyticsEventType,
} from "@/lib/analytics/constants";
import { enqueuePlatformEvent } from "@/lib/analytics/log-event";
import { resolveAnalyzeAnalyticsContext } from "@/lib/analytics/resolve-analyze-context";
import type { DealAnalyzeRequestV1 } from "./deal/schemas/canonical-request";
import type { UnknownRecord } from "./types";
import { runDealAnalyze } from "./deal/analyze";
import { normalizeDealAnalyzeRequest } from "./deal/legacy/normalizeDealAnalyzeRequest";
import { resolveDealAnalyzePolicy } from "./deal/policy/resolvePolicySnapshot";
import {
  validateDealAnalyzeRequestV1,
  validateDealAnalyzeTopLevelKeysOnly,
} from "./deal/schemas/validate-deal-analyze-request";
import type { ValidationIssue } from "./deal/schemas/validation-issue";

export async function readJson(req: Request): Promise<UnknownRecord | null> {
  const text = await req.text();
  if (!text.trim()) {
    return null;
  }
  const parsed: unknown = JSON.parse(text);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected JSON object body");
  }
  return parsed as UnknownRecord;
}

export function jsonError(
  message: string,
  status = 400,
  code?: string,
): Response {
  return Response.json(
    { error: message, ...(code ? { code } : {}) },
    { status },
  );
}

/** POST /api/deal/analyze — 400 envelope (TICKET-001A): always includes `issues`. */
export function dealAnalyze400(
  message: string,
  code: string,
  issues: ValidationIssue[] = [],
): Response {
  return Response.json({ error: message, code, issues }, { status: 400 });
}

function isPlainObject(v: unknown): v is UnknownRecord {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

export type EngineAnalyticsOpts = {
  eventType: AnalyticsEventType;
  toolKey: string | null;
  route: string;
};

export async function handleEnginePost<T>(
  req: Request,
  run: (input: UnknownRecord) => Promise<T>,
  analytics?: EngineAnalyticsOpts,
): Promise<Response> {
  let body: UnknownRecord;
  try {
    body = (await readJson(req)) ?? {};
  } catch {
    if (analytics) {
      enqueuePlatformEvent({
        req,
        eventType: analytics.eventType,
        toolKey: analytics.toolKey,
        route: analytics.route,
        status: "error",
        metadata: { reason: "invalid_json", httpStatus: 400 },
      });
    }
    return jsonError("Invalid JSON body", 400, "INVALID_JSON");
  }
  try {
    const result = await run(body);
    if (analytics) {
      enqueuePlatformEvent({
        req,
        eventType: analytics.eventType,
        toolKey: analytics.toolKey,
        route: analytics.route,
        status: "success",
        metadata: { httpStatus: 200 },
      });
    }
    return Response.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    if (analytics) {
      enqueuePlatformEvent({
        req,
        eventType: analytics.eventType,
        toolKey: analytics.toolKey,
        route: analytics.route,
        status: "error",
        metadata: { httpStatus: 500, code: "INTERNAL" },
      });
    }
    return jsonError(message, 500, "INTERNAL");
  }
}

const MAX_ANALYTICS_COLLATERAL_ADDRESS_CHARS = 500;

function logDealAnalyze(
  req: Request,
  status: "success" | "error",
  metadata: Record<string, unknown>,
  dealSnapshot?: DealAnalyzeRequestV1 | null,
): void {
  const ctx = resolveAnalyzeAnalyticsContext(
    req.headers.get(ANALYTICS_TOOL_KEY_HEADER),
  );
  const extra: Record<string, unknown> = {};
  if (dealSnapshot?.assumptions) {
    const raw = dealSnapshot.assumptions.collateralPropertyAddress;
    if (typeof raw === "string") {
      const t = raw.trim();
      if (t !== "") {
        extra.collateralPropertyAddress = t.slice(
          0,
          MAX_ANALYTICS_COLLATERAL_ADDRESS_CHARS,
        );
      }
    }
  }
  enqueuePlatformEvent({
    req,
    eventType: ctx.eventType,
    toolKey: ctx.toolKey,
    route: "/api/deal/analyze",
    status,
    metadata: { ...metadata, ...extra },
  });
}

/** POST /api/deal/analyze — legacy normalization, validation, canonical engine. */
export async function handleDealAnalyzePost(req: Request): Promise<Response> {
  let raw: UnknownRecord;
  try {
    const text = await req.text();
    if (!text.trim()) {
      logDealAnalyze(req, "error", {
        phase: "parse",
        httpStatus: 400,
        code: "INVALID_JSON",
      });
      return dealAnalyze400("Empty request body", "INVALID_JSON", []);
    }
    const parsed: unknown = JSON.parse(text);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      logDealAnalyze(req, "error", {
        phase: "parse",
        httpStatus: 400,
        code: "INVALID_JSON",
      });
      return dealAnalyze400("Expected JSON object body", "INVALID_JSON", []);
    }
    raw = parsed as UnknownRecord;
  } catch {
    logDealAnalyze(req, "error", {
      phase: "parse",
      httpStatus: 400,
      code: "INVALID_JSON",
    });
    return dealAnalyze400("Invalid JSON body", "INVALID_JSON", []);
  }

  if (isPlainObject(raw.deal) && isPlainObject(raw.loan)) {
    logDealAnalyze(req, "error", {
      phase: "validation",
      httpStatus: 400,
      code: "AMBIGUOUS_INPUT_SHAPE",
    });
    return dealAnalyze400(
      "Request cannot include both `deal` and top-level `loan` (ambiguous legacy vs canonical shape).",
      "AMBIGUOUS_INPUT_SHAPE",
      [
        {
          path: "deal",
          message:
            "Remove `deal` or remove `loan` so the server can choose a single input shape.",
        },
        {
          path: "loan",
          message:
            "Remove `deal` or remove `loan` so the server can choose a single input shape.",
        },
      ],
    );
  }

  const topLevelErr = validateDealAnalyzeTopLevelKeysOnly(raw);
  if (topLevelErr) {
    logDealAnalyze(req, "error", {
      phase: "validation",
      httpStatus: 400,
      code: topLevelErr.code,
    });
    return dealAnalyze400(
      topLevelErr.message,
      topLevelErr.code,
      topLevelErr.issues,
    );
  }

  const { normalized, notes } = normalizeDealAnalyzeRequest(raw);
  const validated = validateDealAnalyzeRequestV1(normalized);
  if (!validated.ok) {
    logDealAnalyze(req, "error", {
      phase: "validation",
      httpStatus: 400,
      code: validated.code,
    });
    return dealAnalyze400(validated.message, validated.code, validated.issues);
  }

  let policyConfigSource: "published" | "fallback" = "fallback";
  try {
    const policySnapshot = await resolveDealAnalyzePolicy();
    policyConfigSource = policySnapshot.source;
    const result = await runDealAnalyze(validated.value, {
      normalizationNotes: notes,
      policySnapshot,
      includePolicyConfigFallbackFlag: true,
    });
    logDealAnalyze(
      req,
      "success",
      {
        phase: "engine",
        httpStatus: 200,
        normalizationNoteCount: notes.length,
        policyConfigSource,
      },
      validated.value,
    );
    return Response.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    logDealAnalyze(
      req,
      "error",
      {
        phase: "engine",
        httpStatus: 500,
        code: "INTERNAL",
      },
      validated.value,
    );
    return jsonError(message, 500, "INTERNAL");
  }
}
