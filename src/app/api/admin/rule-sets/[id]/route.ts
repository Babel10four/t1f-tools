import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth/session-server";
import { validateRulePayload } from "@/lib/rule-sets/validate-payload";
import type { RuleType } from "@/lib/rule-sets/constants";
import { getRuleSet, updateRuleSetDraft } from "@/lib/rule-sets/service";

export const runtime = "nodejs";

type PatchBody = {
  version_label?: unknown;
  effective_date?: unknown;
  json_payload?: unknown;
  source_document_id?: unknown;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSessionPayload();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await context.params;

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const existing = await getRuleSet(id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const patch: Parameters<typeof updateRuleSetDraft>[1] = {};

  if (body.version_label !== undefined) {
    if (typeof body.version_label !== "string" || body.version_label.trim() === "") {
      return NextResponse.json({ error: "version_label invalid" }, { status: 400 });
    }
    patch.versionLabel = body.version_label.trim();
  }

  if (body.effective_date !== undefined) {
    if (body.effective_date !== null && typeof body.effective_date !== "string") {
      return NextResponse.json({ error: "effective_date invalid" }, { status: 400 });
    }
    patch.effectiveDate =
      body.effective_date === null || body.effective_date === ""
        ? null
        : String(body.effective_date);
  }

  if (body.json_payload !== undefined) {
    const validated = validateRulePayload(
      existing.ruleType as RuleType,
      body.json_payload,
    );
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    patch.jsonPayload = validated.payload;
  }

  if (body.source_document_id !== undefined) {
    if (body.source_document_id !== null && typeof body.source_document_id !== "string") {
      return NextResponse.json({ error: "source_document_id invalid" }, { status: 400 });
    }
    patch.sourceDocumentId =
      body.source_document_id === null ? null : body.source_document_id;
  }

  try {
    const row = await updateRuleSetDraft(id, patch);
    return NextResponse.json({ ruleSet: row });
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    if (code === "NOT_FOUND") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (code === "INVALID_STATE") {
      return NextResponse.json({ error: "Only draft can be edited" }, { status: 400 });
    }
    if (code === "SOURCE_DOCUMENT_NOT_FOUND") {
      return NextResponse.json({ error: "source_document_id not found" }, { status: 400 });
    }
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
