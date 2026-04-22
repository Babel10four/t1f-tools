import { NextResponse } from "next/server";
import { enqueuePlatformEvent } from "@/lib/analytics/log-event";
import { getSessionPayload } from "@/lib/auth/session-server";
import { publishDocument } from "@/lib/documents/service";

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
    await publishDocument(id);
    enqueuePlatformEvent({
      req: _request,
      eventType: "document_published",
      toolKey: null,
      route: "/api/admin/documents/[id]/publish",
      status: "success",
      metadata: { documentId: id },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    enqueuePlatformEvent({
      req: _request,
      eventType: "document_published",
      toolKey: null,
      route: "/api/admin/documents/[id]/publish",
      status: "error",
      metadata: { documentId: id, code: code || "unknown" },
    });
    if (code === "NOT_FOUND") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (code === "INVALID_STATE") {
      return NextResponse.json({ error: "Invalid state" }, { status: 400 });
    }
    return NextResponse.json({ error: "Publish failed" }, { status: 500 });
  }
}
