import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth/session-server";
import { RULE_TYPES, type RuleType } from "@/lib/rule-sets/constants";
import { insertRuleSet, listRuleSets } from "@/lib/rule-sets/service";
import { validateRulePayload } from "@/lib/rule-sets/validate-payload";

export const runtime = "nodejs";

function parseRuleType(v: string | null): RuleType | null {
  if (!v) {
    return null;
  }
  return RULE_TYPES.includes(v as RuleType) ? (v as RuleType) : null;
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s,
  );
}

export async function GET(request: Request) {
  const session = await getSessionPayload();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const rt = parseRuleType(searchParams.get("rule_type"));
  const st = searchParams.get("status");
  const status =
    st === "draft" || st === "published" || st === "archived" ? st : undefined;
  try {
    const rows = await listRuleSets({
      ...(rt ? { ruleType: rt } : {}),
      ...(status ? { status } : {}),
    });
    return NextResponse.json({ ruleSets: rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}

type CreateBody = {
  rule_type?: unknown;
  version_label?: unknown;
  effective_date?: unknown;
  series_id?: unknown;
  json_payload?: unknown;
  source_document_id?: unknown;
};

export async function POST(request: Request) {
  const session = await getSessionPayload();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ruleType = body.rule_type;
  if (typeof ruleType !== "string" || !parseRuleType(ruleType)) {
    return NextResponse.json({ error: "invalid rule_type" }, { status: 400 });
  }

  const versionLabel = body.version_label;
  if (typeof versionLabel !== "string" || versionLabel.trim() === "") {
    return NextResponse.json({ error: "version_label required" }, { status: 400 });
  }

  let effectiveDate: string | null = null;
  if (body.effective_date !== undefined && body.effective_date !== null) {
    if (typeof body.effective_date !== "string") {
      return NextResponse.json({ error: "effective_date invalid" }, { status: 400 });
    }
    effectiveDate = body.effective_date.trim() || null;
  }

  let seriesId: string;
  if (typeof body.series_id === "string" && body.series_id.length > 0) {
    if (!isUuid(body.series_id)) {
      return NextResponse.json({ error: "series_id must be a UUID" }, { status: 400 });
    }
    seriesId = body.series_id;
  } else {
    seriesId = randomUUID();
  }

  let sourceDocumentId: string | null = null;
  if (body.source_document_id !== undefined && body.source_document_id !== null) {
    if (typeof body.source_document_id !== "string") {
      return NextResponse.json({ error: "source_document_id invalid" }, { status: 400 });
    }
    sourceDocumentId = body.source_document_id;
  }

  const payloadRaw = body.json_payload;
  const validated = validateRulePayload(ruleType as RuleType, payloadRaw);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const id = randomUUID();
  try {
    const row = await insertRuleSet({
      id,
      seriesId,
      ruleType: ruleType as RuleType,
      versionLabel: versionLabel.trim(),
      effectiveDate,
      jsonPayload: validated.payload,
      sourceDocumentId,
      createdByRole: session.role,
    });
    return NextResponse.json({ ruleSet: row });
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    if (code === "SOURCE_DOCUMENT_NOT_FOUND") {
      return NextResponse.json({ error: "source_document_id not found" }, { status: 400 });
    }
    return NextResponse.json({ error: "Create failed" }, { status: 503 });
  }
}
