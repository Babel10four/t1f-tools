import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { enqueuePlatformEvent } from "@/lib/analytics/log-event";
import { getSessionPayload } from "@/lib/auth/session-server";
import { DOCUMENT_TYPES, type DocumentType } from "@/lib/documents/constants";
import { extractPdfTextBestEffort } from "@/lib/documents/extract-text";
import { insertDocument } from "@/lib/documents/service";
import { isLikelyPdf } from "@/lib/documents/pdf";
import { putPdfBytes } from "@/lib/storage/document-storage";

export const runtime = "nodejs";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s,
  );
}

/**
 * POST /api/admin/documents/upload — multipart: file + metadata (admin-only).
 */
export async function POST(request: Request) {
  const session = await getSessionPayload();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  const docType = form.get("doc_type");
  if (typeof docType !== "string" || !DOCUMENT_TYPES.includes(docType as DocumentType)) {
    return NextResponse.json({ error: "invalid doc_type" }, { status: 400 });
  }

  const title = form.get("title");
  const versionLabel = form.get("version_label");
  if (typeof title !== "string" || title.trim() === "") {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }
  if (typeof versionLabel !== "string" || versionLabel.trim() === "") {
    return NextResponse.json({ error: "version_label required" }, { status: 400 });
  }

  const effectiveRaw = form.get("effective_date");
  let effectiveDate: string | null = null;
  if (typeof effectiveRaw === "string" && effectiveRaw.trim() !== "") {
    effectiveDate = effectiveRaw.trim();
  }

  const seriesRaw = form.get("series_id");
  let seriesId: string;
  if (typeof seriesRaw === "string" && isUuid(seriesRaw)) {
    seriesId = seriesRaw;
  } else {
    seriesId = randomUUID();
  }

  const notesRaw = form.get("notes");
  const notes =
    typeof notesRaw === "string" && notesRaw.trim() !== "" ? notesRaw.trim() : null;

  const buf = Buffer.from(await file.arrayBuffer());
  if (!isLikelyPdf(buf)) {
    return NextResponse.json(
      { error: "Only PDF uploads are allowed" },
      { status: 400 },
    );
  }

  const id = randomUUID();
  let storageKey: string;
  try {
    const up = await putPdfBytes(id, buf);
    storageKey = up.storageKey;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Storage failed";
    enqueuePlatformEvent({
      req: request,
      eventType: "document_uploaded",
      toolKey: null,
      route: "/api/admin/documents/upload",
      status: "error",
      metadata: { phase: "storage", message: msg.slice(0, 500) },
    });
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  const extractedText = await extractPdfTextBestEffort(buf);

  try {
    const row = await insertDocument({
      id,
      seriesId,
      docType: docType as DocumentType,
      title: title.trim(),
      versionLabel: versionLabel.trim(),
      effectiveDate,
      storageKey,
      byteSize: buf.length,
      originalFilename: file.name || "upload.pdf",
      extractedText,
      notes,
      createdByRole: session.role,
    });
    enqueuePlatformEvent({
      req: request,
      eventType: "document_uploaded",
      toolKey: null,
      route: "/api/admin/documents/upload",
      status: "success",
      metadata: { documentId: row.id, docType: row.docType },
    });
    return NextResponse.json({ document: row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Persist failed";
    enqueuePlatformEvent({
      req: request,
      eventType: "document_uploaded",
      toolKey: null,
      route: "/api/admin/documents/upload",
      status: "error",
      metadata: { phase: "persist", message: msg.slice(0, 500) },
    });
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}
