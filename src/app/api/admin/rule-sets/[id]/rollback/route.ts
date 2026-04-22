import { NextResponse } from "next/server";
import { enqueuePlatformEvent } from "@/lib/analytics/log-event";
import { getSessionPayload } from "@/lib/auth/session-server";
import { rollbackRuleSet } from "@/lib/rule-sets/service";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSessionPayload();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await context.params;
  try {
    await rollbackRuleSet(id);
    enqueuePlatformEvent({
      req: request,
      eventType: "rule_set_updated",
      toolKey: null,
      route: "/api/admin/rule-sets/[id]/rollback",
      status: "success",
      metadata: { ruleSetId: id, action: "rollback" },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    enqueuePlatformEvent({
      req: request,
      eventType: "rule_set_updated",
      toolKey: null,
      route: "/api/admin/rule-sets/[id]/rollback",
      status: "error",
      metadata: { ruleSetId: id, action: "rollback", code: code || "unknown" },
    });
    if (code === "NOT_FOUND") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (code === "INVALID_STATE") {
      return NextResponse.json({ error: "Invalid state" }, { status: 400 });
    }
    return NextResponse.json({ error: "Rollback failed" }, { status: 500 });
  }
}
