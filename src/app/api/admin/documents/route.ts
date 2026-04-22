import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth/session-server";
import { listDocuments } from "@/lib/documents/service";

export const runtime = "nodejs";

/**
 * GET /api/admin/documents — list metadata (admin-only via middleware).
 */
export async function GET() {
  const session = await getSessionPayload();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const rows = await listDocuments();
    return NextResponse.json({ documents: rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}
