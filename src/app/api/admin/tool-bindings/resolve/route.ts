import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth/session-server";
import { parseBindingType } from "@/lib/bindings/service";
import { resolveToolBinding, toResolvedMeta } from "@/lib/bindings/resolve";

export const runtime = "nodejs";

/**
 * Admin-only: inspect resolver output (metadata only — no raw PDF / full rule JSON in v1).
 */
export async function GET(request: Request) {
  const session = await getSessionPayload();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const toolKey = searchParams.get("tool_key");
  const bindingType = parseBindingType(searchParams.get("binding_type"));
  if (!toolKey?.trim()) {
    return NextResponse.json({ error: "tool_key required" }, { status: 400 });
  }
  if (!bindingType) {
    return NextResponse.json({ error: "binding_type required" }, { status: 400 });
  }

  const result = await resolveToolBinding(toolKey.trim(), bindingType);
  if (result.state === "resolved") {
    return NextResponse.json({
      state: "resolved",
      meta: toResolvedMeta(result),
    });
  }
  if (result.state === "missing") {
    return NextResponse.json({
      state: "missing",
      reason: result.reason,
    });
  }
  return NextResponse.json({
    state: "unconfigured",
    reason: result.reason,
    bindingId: result.bindingId,
  });
}
