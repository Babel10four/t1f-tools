import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  documents,
  ruleSets,
  toolContextBindings,
  type BindingTypeV1,
  type DocumentRow,
  type RuleSetRow,
} from "@/db/schema";
import {
  documentMatchesBindingType,
  ruleSetMatchesBindingType,
} from "./target-validation";

export type ResolveReason =
  | "no_published_binding"
  | "target_not_published"
  | "target_type_mismatch"
  | "binding_not_published";

export type ResolveToolBindingResult =
  | {
      state: "resolved";
      bindingId: string;
      kind: "document";
      document: DocumentRow;
    }
  | {
      state: "resolved";
      bindingId: string;
      kind: "rule_set";
      ruleSet: RuleSetRow;
    }
  | {
      state: "missing";
      reason: "no_published_binding";
    }
  | {
      state: "unconfigured";
      reason: Exclude<ResolveReason, "no_published_binding">;
      bindingId?: string;
    };

/**
 * Server-only resolver: one published binding row per (tool_key, binding_type) (partial unique index).
 * Does **not** use ORDER BY created_at or any "latest upload" heuristic.
 */
export async function resolveToolBinding(
  toolKey: string,
  bindingType: BindingTypeV1,
): Promise<ResolveToolBindingResult> {
  const db = getDb();
  const [binding] = await db
    .select()
    .from(toolContextBindings)
    .where(
      and(
        eq(toolContextBindings.toolKey, toolKey),
        eq(toolContextBindings.bindingType, bindingType),
        eq(toolContextBindings.status, "published"),
      ),
    )
    .limit(1);

  if (!binding) {
    return { state: "missing", reason: "no_published_binding" };
  }

  if (binding.documentId) {
    const [doc] = await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.id, binding.documentId),
          eq(documents.status, "published"),
        ),
      )
      .limit(1);
    if (!doc) {
      return {
        state: "unconfigured",
        reason: "target_not_published",
        bindingId: binding.id,
      };
    }
    if (!documentMatchesBindingType(bindingType, doc)) {
      return {
        state: "unconfigured",
        reason: "target_type_mismatch",
        bindingId: binding.id,
      };
    }
    return {
      state: "resolved",
      bindingId: binding.id,
      kind: "document",
      document: doc,
    };
  }

  if (binding.ruleSetId) {
    const [rs] = await db
      .select()
      .from(ruleSets)
      .where(
        and(
          eq(ruleSets.id, binding.ruleSetId),
          eq(ruleSets.status, "published"),
        ),
      )
      .limit(1);
    if (!rs) {
      return {
        state: "unconfigured",
        reason: "target_not_published",
        bindingId: binding.id,
      };
    }
    if (!ruleSetMatchesBindingType(bindingType, rs)) {
      return {
        state: "unconfigured",
        reason: "target_type_mismatch",
        bindingId: binding.id,
      };
    }
    return {
      state: "resolved",
      bindingId: binding.id,
      kind: "rule_set",
      ruleSet: rs,
    };
  }

  return {
    state: "unconfigured",
    reason: "binding_not_published",
    bindingId: binding.id,
  };
}

/** Minimal metadata for admin/debug — no PDF bytes. */
export type ResolvedArtifactMeta =
  | { kind: "document"; id: string; title: string; versionLabel: string }
  | {
      kind: "rule_set";
      id: string;
      ruleType: RuleSetRow["ruleType"];
      versionLabel: string;
    };

export function toResolvedMeta(
  r: Extract<ResolveToolBindingResult, { state: "resolved" }>,
): ResolvedArtifactMeta {
  if (r.kind === "document") {
    return {
      kind: "document",
      id: r.document.id,
      title: r.document.title,
      versionLabel: r.document.versionLabel,
    };
  }
  return {
    kind: "rule_set",
    id: r.ruleSet.id,
    ruleType: r.ruleSet.ruleType,
    versionLabel: r.ruleSet.versionLabel,
  };
}
