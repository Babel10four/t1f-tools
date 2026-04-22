import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth/session-server";
import { bindingTypesV1 } from "@/db/schema";
import {
  insertBindingDraft,
  listToolBindings,
  parseBindingType,
} from "@/lib/bindings/service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getSessionPayload();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const toolKey = searchParams.get("tool_key") ?? undefined;
  const st = searchParams.get("status");
  const status =
    st === "draft" || st === "published" || st === "archived" ? st : undefined;
  try {
    const bindings = await listToolBindings({
      ...(toolKey ? { toolKey } : {}),
      ...(status ? { status } : {}),
    });
    return NextResponse.json({ bindings });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}

type CreateBody = {
  tool_key?: unknown;
  binding_type?: unknown;
  document_id?: unknown;
  rule_set_id?: unknown;
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

  const toolKey = body.tool_key;
  if (typeof toolKey !== "string" || toolKey.trim() === "") {
    return NextResponse.json({ error: "tool_key required" }, { status: 400 });
  }

  const bt = parseBindingType(body.binding_type);
  if (!bt) {
    return NextResponse.json(
      { error: "binding_type invalid", allowed: bindingTypesV1 },
      { status: 400 },
    );
  }

  let documentId: string | null = null;
  let ruleSetId: string | null = null;
  if (body.document_id != null) {
    if (typeof body.document_id !== "string") {
      return NextResponse.json({ error: "document_id invalid" }, { status: 400 });
    }
    documentId = body.document_id;
  }
  if (body.rule_set_id != null) {
    if (typeof body.rule_set_id !== "string") {
      return NextResponse.json({ error: "rule_set_id invalid" }, { status: 400 });
    }
    ruleSetId = body.rule_set_id;
  }

  try {
    const row = await insertBindingDraft({
      toolKey: toolKey.trim(),
      bindingType: bt,
      documentId,
      ruleSetId,
      createdByRole: session.role,
    });
    return NextResponse.json({ binding: row });
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    const map: Record<string, number> = {
      INVALID_TARGET_SHAPE: 400,
      DOCUMENT_NOT_FOUND: 400,
      DOCUMENT_TYPE_MISMATCH: 400,
      RULE_SET_NOT_FOUND: 400,
      RULE_SET_TYPE_MISMATCH: 400,
      INVALID_BINDING_TYPE: 400,
    };
    const status = map[code] ?? 503;
    return NextResponse.json({ error: code || "Create failed" }, { status });
  }
}
