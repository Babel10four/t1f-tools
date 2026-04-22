import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth/session-server";
import { publishBinding } from "@/lib/bindings/service";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSessionPayload();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await context.params;
  try {
    await publishBinding(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    if (code === "NOT_FOUND") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (code === "INVALID_STATE") {
      return NextResponse.json({ error: "Invalid state" }, { status: 400 });
    }
    if (code === "TARGET_NOT_PUBLISHED") {
      return NextResponse.json(
        { error: "Target document or rule set must be published first" },
        { status: 400 },
      );
    }
    if (code === "DOCUMENT_TYPE_MISMATCH" || code === "RULE_SET_TYPE_MISMATCH") {
      return NextResponse.json({ error: code }, { status: 400 });
    }
    return NextResponse.json({ error: "Publish failed" }, { status: 500 });
  }
}
