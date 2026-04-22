import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth/session-server";
import { getDocument } from "@/lib/documents/service";
import { readPdfBytes } from "@/lib/storage/document-storage";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSessionPayload();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await context.params;
  const row = await getDocument(id);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const buf = await readPdfBytes(row.storageKey);
    const name = row.originalFilename?.replace(/[^\w.\-]+/g, "_") || "document.pdf";
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${name}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "File unavailable" }, { status: 503 });
  }
}
