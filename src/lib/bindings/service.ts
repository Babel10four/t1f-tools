import { and, desc, eq, ne } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  documents,
  ruleSets,
  toolContextBindings,
  type BindingTypeV1,
  type DocumentRow,
  type RuleSetRow,
  type ToolContextBindingRow,
} from "@/db/schema";
import {
  bindingTypeUsesDocument,
  bindingTypeUsesRuleSet,
  isBindingTypeV1,
} from "./constants";
import {
  documentMatchesBindingType,
  ruleSetMatchesBindingType,
} from "./target-validation";

export type CreateBindingDraftInput = {
  toolKey: string;
  bindingType: BindingTypeV1;
  documentId: string | null;
  ruleSetId: string | null;
  createdByRole: string;
};

async function loadDocument(id: string): Promise<DocumentRow | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);
  return row;
}

async function loadRuleSet(id: string): Promise<RuleSetRow | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(ruleSets)
    .where(eq(ruleSets.id, id))
    .limit(1);
  return row;
}

export async function listToolBindings(filters?: {
  toolKey?: string;
  status?: "draft" | "published" | "archived";
}): Promise<ToolContextBindingRow[]> {
  const db = getDb();
  const conds = [];
  if (filters?.toolKey) {
    conds.push(eq(toolContextBindings.toolKey, filters.toolKey));
  }
  if (filters?.status) {
    conds.push(eq(toolContextBindings.status, filters.status));
  }
  if (conds.length === 0) {
    return db
      .select()
      .from(toolContextBindings)
      .orderBy(desc(toolContextBindings.createdAt));
  }
  return db
    .select()
    .from(toolContextBindings)
    .where(and(...conds))
    .orderBy(desc(toolContextBindings.createdAt));
}

export async function getToolBinding(
  id: string,
): Promise<ToolContextBindingRow | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(toolContextBindings)
    .where(eq(toolContextBindings.id, id))
    .limit(1);
  return row;
}

/**
 * Create a draft binding. Targets should exist; publish enforces published targets.
 */
export async function insertBindingDraft(
  input: CreateBindingDraftInput,
): Promise<ToolContextBindingRow> {
  const { toolKey, bindingType, documentId, ruleSetId, createdByRole } = input;
  if (bindingTypeUsesDocument(bindingType)) {
    if (!documentId || ruleSetId) {
      throw new Error("INVALID_TARGET_SHAPE");
    }
    const doc = await loadDocument(documentId);
    if (!doc) {
      throw new Error("DOCUMENT_NOT_FOUND");
    }
    if (!documentMatchesBindingType(bindingType, doc)) {
      throw new Error("DOCUMENT_TYPE_MISMATCH");
    }
  } else if (bindingTypeUsesRuleSet(bindingType)) {
    if (!ruleSetId || documentId) {
      throw new Error("INVALID_TARGET_SHAPE");
    }
    const rs = await loadRuleSet(ruleSetId);
    if (!rs) {
      throw new Error("RULE_SET_NOT_FOUND");
    }
    if (!ruleSetMatchesBindingType(bindingType, rs)) {
      throw new Error("RULE_SET_TYPE_MISMATCH");
    }
  } else {
    throw new Error("INVALID_BINDING_TYPE");
  }

  const db = getDb();
  const [row] = await db
    .insert(toolContextBindings)
    .values({
      toolKey: toolKey.trim(),
      bindingType,
      documentId: documentId ?? null,
      ruleSetId: ruleSetId ?? null,
      status: "draft",
      createdByRole,
    })
    .returning();
  if (!row) {
    throw new Error("INSERT_FAILED");
  }
  return row;
}

/**
 * draft → published; archives prior published row for same (tool_key, binding_type),
 * sets superseded_by on archived rows.
 */
export async function publishBinding(bindingId: string): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(toolContextBindings)
      .where(eq(toolContextBindings.id, bindingId))
      .limit(1);
    if (!row) {
      throw new Error("NOT_FOUND");
    }
    if (row.status !== "draft") {
      throw new Error("INVALID_STATE");
    }

    if (row.documentId) {
      const doc = await tx
        .select()
        .from(documents)
        .where(eq(documents.id, row.documentId))
        .limit(1);
      const d = doc[0];
      if (!d || d.status !== "published") {
        throw new Error("TARGET_NOT_PUBLISHED");
      }
      if (!documentMatchesBindingType(row.bindingType, d)) {
        throw new Error("DOCUMENT_TYPE_MISMATCH");
      }
    } else if (row.ruleSetId) {
      const rsRows = await tx
        .select()
        .from(ruleSets)
        .where(eq(ruleSets.id, row.ruleSetId))
        .limit(1);
      const rs = rsRows[0];
      if (!rs || rs.status !== "published") {
        throw new Error("TARGET_NOT_PUBLISHED");
      }
      if (!ruleSetMatchesBindingType(row.bindingType, rs)) {
        throw new Error("RULE_SET_TYPE_MISMATCH");
      }
    } else {
      throw new Error("INVALID_TARGET_SHAPE");
    }

    const publishedOthers = await tx
      .select({ id: toolContextBindings.id })
      .from(toolContextBindings)
      .where(
        and(
          eq(toolContextBindings.toolKey, row.toolKey),
          eq(toolContextBindings.bindingType, row.bindingType),
          eq(toolContextBindings.status, "published"),
          ne(toolContextBindings.id, bindingId),
        ),
      );

    for (const p of publishedOthers) {
      await tx
        .update(toolContextBindings)
        .set({
          status: "archived",
          archivedAt: new Date(),
          supersededByBindingId: bindingId,
        })
        .where(eq(toolContextBindings.id, p.id));
    }

    await tx
      .update(toolContextBindings)
      .set({
        status: "published",
        publishedAt: new Date(),
        archivedAt: null,
      })
      .where(eq(toolContextBindings.id, bindingId));
  });
}

export async function archiveBinding(bindingId: string): Promise<void> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(toolContextBindings)
    .where(eq(toolContextBindings.id, bindingId))
    .limit(1);
  if (!row) {
    throw new Error("NOT_FOUND");
  }
  if (row.status === "archived") {
    throw new Error("INVALID_STATE");
  }
  await db
    .update(toolContextBindings)
    .set({
      status: "archived",
      archivedAt: new Date(),
    })
    .where(eq(toolContextBindings.id, bindingId));
}

export function parseBindingType(raw: unknown): BindingTypeV1 | null {
  if (typeof raw !== "string") {
    return null;
  }
  return isBindingTypeV1(raw) ? raw : null;
}
