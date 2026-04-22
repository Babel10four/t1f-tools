import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { documents, type DocumentRow } from "@/db/schema";
import type { DocumentType } from "./constants";

export type CreateDocumentInput = {
  id: string;
  seriesId: string;
  docType: DocumentType;
  title: string;
  versionLabel: string;
  effectiveDate: string | null;
  storageKey: string;
  byteSize: number;
  originalFilename: string;
  extractedText: string | null;
  notes: string | null;
  createdByRole: string;
};

export async function listDocuments(): Promise<DocumentRow[]> {
  const db = getDb();
  return db.select().from(documents).orderBy(desc(documents.createdAt));
}

export async function getDocument(id: string): Promise<DocumentRow | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);
  return row;
}

export async function insertDocument(
  input: CreateDocumentInput,
): Promise<DocumentRow> {
  const db = getDb();
  const [row] = await db
    .insert(documents)
    .values({
      id: input.id,
      seriesId: input.seriesId,
      docType: input.docType,
      title: input.title,
      versionLabel: input.versionLabel,
      effectiveDate: input.effectiveDate,
      status: "draft",
      storageKey: input.storageKey,
      contentType: "application/pdf",
      byteSize: input.byteSize,
      originalFilename: input.originalFilename,
      extractedText: input.extractedText,
      notes: input.notes,
      createdByRole: input.createdByRole,
    })
    .returning();
  if (!row) {
    throw new Error("insert failed");
  }
  return row;
}

/**
 * draft → published; any other `published` row in the same series → archived.
 */
export async function publishDocument(documentId: string): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);
    if (!row) {
      throw new Error("NOT_FOUND");
    }
    if (row.status !== "draft") {
      throw new Error("INVALID_STATE");
    }
    await tx
      .update(documents)
      .set({
        status: "archived",
        archivedAt: new Date(),
      })
      .where(
        and(
          eq(documents.seriesId, row.seriesId),
          eq(documents.status, "published"),
        ),
      );

    await tx
      .update(documents)
      .set({
        status: "published",
        publishedAt: new Date(),
        archivedAt: null,
      })
      .where(eq(documents.id, documentId));
  });
}

/**
 * Rollback: re-activate an `archived` row as `published`; current `published` in series → archived.
 * Reversible — no deletes (PLATFORM-DATA-001).
 */
export async function rollbackToDocument(documentId: string): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    const [target] = await tx
      .select()
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);
    if (!target) {
      throw new Error("NOT_FOUND");
    }
    if (target.status !== "archived") {
      throw new Error("INVALID_STATE");
    }

    await tx
      .update(documents)
      .set({
        status: "archived",
        archivedAt: new Date(),
      })
      .where(
        and(
          eq(documents.seriesId, target.seriesId),
          eq(documents.status, "published"),
        ),
      );

    await tx
      .update(documents)
      .set({
        status: "published",
        publishedAt: new Date(),
        archivedAt: null,
      })
      .where(eq(documents.id, documentId));
  });
}

/** draft or published → archived (no delete). */
export async function archiveDocument(documentId: string): Promise<void> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);
  if (!row) {
    throw new Error("NOT_FOUND");
  }
  if (row.status === "archived") {
    throw new Error("INVALID_STATE");
  }
  await db
    .update(documents)
    .set({
      status: "archived",
      archivedAt: new Date(),
    })
    .where(eq(documents.id, documentId));
}
