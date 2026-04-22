import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { documents, ruleSets, type RuleSetRow } from "@/db/schema";
import type { RuleType } from "./constants";
import type { ValidatedPayload } from "./validate-payload";

export type CreateRuleSetInput = {
  id: string;
  seriesId: string;
  ruleType: RuleType;
  versionLabel: string;
  effectiveDate: string | null;
  jsonPayload: ValidatedPayload;
  sourceDocumentId: string | null;
  createdByRole: string;
};

export type UpdateDraftInput = {
  versionLabel?: string;
  effectiveDate?: string | null;
  jsonPayload?: ValidatedPayload;
  sourceDocumentId?: string | null;
};

export async function listRuleSets(filters?: {
  ruleType?: RuleType;
  status?: "draft" | "published" | "archived";
}): Promise<RuleSetRow[]> {
  const db = getDb();
  if (!filters?.ruleType && !filters?.status) {
    return db.select().from(ruleSets).orderBy(desc(ruleSets.createdAt));
  }
  const conds = [];
  if (filters?.ruleType) {
    conds.push(eq(ruleSets.ruleType, filters.ruleType));
  }
  if (filters?.status) {
    conds.push(eq(ruleSets.status, filters.status));
  }
  return db
    .select()
    .from(ruleSets)
    .where(and(...conds))
    .orderBy(desc(ruleSets.createdAt));
}

export async function getRuleSet(id: string): Promise<RuleSetRow | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(ruleSets)
    .where(eq(ruleSets.id, id))
    .limit(1);
  return row;
}

/** Single published row per `rule_type` (CONFIG-001). */
export async function getPublishedRuleSetByType(
  ruleType: RuleType,
): Promise<RuleSetRow | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(ruleSets)
    .where(
      and(eq(ruleSets.ruleType, ruleType), eq(ruleSets.status, "published")),
    )
    .limit(1);
  return row;
}

export async function documentExists(id: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);
  return row !== undefined;
}

export async function insertRuleSet(input: CreateRuleSetInput): Promise<RuleSetRow> {
  if (input.sourceDocumentId) {
    const ok = await documentExists(input.sourceDocumentId);
    if (!ok) {
      throw new Error("SOURCE_DOCUMENT_NOT_FOUND");
    }
  }
  const db = getDb();
  const [row] = await db
    .insert(ruleSets)
    .values({
      id: input.id,
      seriesId: input.seriesId,
      ruleType: input.ruleType,
      versionLabel: input.versionLabel,
      effectiveDate: input.effectiveDate,
      status: "draft",
      jsonPayload: input.jsonPayload as Record<string, unknown>,
      sourceDocumentId: input.sourceDocumentId,
      createdByRole: input.createdByRole,
    })
    .returning();
  if (!row) {
    throw new Error("insert failed");
  }
  return row;
}

export async function updateRuleSetDraft(
  id: string,
  patch: UpdateDraftInput,
): Promise<RuleSetRow> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(ruleSets)
    .where(eq(ruleSets.id, id))
    .limit(1);
  if (!row) {
    throw new Error("NOT_FOUND");
  }
  if (row.status !== "draft") {
    throw new Error("INVALID_STATE");
  }
  if (patch.sourceDocumentId) {
    const ok = await documentExists(patch.sourceDocumentId);
    if (!ok) {
      throw new Error("SOURCE_DOCUMENT_NOT_FOUND");
    }
  }
  const [updated] = await db
    .update(ruleSets)
    .set({
      ...(patch.versionLabel !== undefined
        ? { versionLabel: patch.versionLabel }
        : {}),
      ...(patch.effectiveDate !== undefined
        ? { effectiveDate: patch.effectiveDate }
        : {}),
      ...(patch.jsonPayload !== undefined
        ? { jsonPayload: patch.jsonPayload as Record<string, unknown> }
        : {}),
      ...(patch.sourceDocumentId !== undefined
        ? { sourceDocumentId: patch.sourceDocumentId }
        : {}),
    })
    .where(eq(ruleSets.id, id))
    .returning();
  if (!updated) {
    throw new Error("update failed");
  }
  return updated;
}

/**
 * draft → published; any other `published` row for the same `rule_type` → archived.
 */
export async function publishRuleSet(ruleSetId: string): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(ruleSets)
      .where(eq(ruleSets.id, ruleSetId))
      .limit(1);
    if (!row) {
      throw new Error("NOT_FOUND");
    }
    if (row.status !== "draft") {
      throw new Error("INVALID_STATE");
    }

    await tx
      .update(ruleSets)
      .set({
        status: "archived",
        archivedAt: new Date(),
      })
      .where(
        and(
          eq(ruleSets.ruleType, row.ruleType),
          eq(ruleSets.status, "published"),
        ),
      );

    await tx
      .update(ruleSets)
      .set({
        status: "published",
        publishedAt: new Date(),
        archivedAt: null,
      })
      .where(eq(ruleSets.id, ruleSetId));
  });
}

/** archived → published; current `published` for same `rule_type` → archived. */
export async function rollbackRuleSet(ruleSetId: string): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    const [target] = await tx
      .select()
      .from(ruleSets)
      .where(eq(ruleSets.id, ruleSetId))
      .limit(1);
    if (!target) {
      throw new Error("NOT_FOUND");
    }
    if (target.status !== "archived") {
      throw new Error("INVALID_STATE");
    }

    await tx
      .update(ruleSets)
      .set({
        status: "archived",
        archivedAt: new Date(),
      })
      .where(
        and(
          eq(ruleSets.ruleType, target.ruleType),
          eq(ruleSets.status, "published"),
        ),
      );

    await tx
      .update(ruleSets)
      .set({
        status: "published",
        publishedAt: new Date(),
        archivedAt: null,
      })
      .where(eq(ruleSets.id, ruleSetId));
  });
}

export async function archiveRuleSet(ruleSetId: string): Promise<void> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(ruleSets)
    .where(eq(ruleSets.id, ruleSetId))
    .limit(1);
  if (!row) {
    throw new Error("NOT_FOUND");
  }
  if (row.status === "archived") {
    throw new Error("INVALID_STATE");
  }
  await db
    .update(ruleSets)
    .set({
      status: "archived",
      archivedAt: new Date(),
    })
    .where(eq(ruleSets.id, ruleSetId));
}
