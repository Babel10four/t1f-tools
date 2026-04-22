import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth/session-server";
import { archiveRuleSet } from "@/lib/rule-sets/service";

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
    await archiveRuleSet(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    if (code === "NOT_FOUND") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (code === "INVALID_STATE") {
      return NextResponse.json({ error: "Invalid state" }, { status: 400 });
    }
    return NextResponse.json({ error: "Archive failed" }, { status: 500 });
  }
}
