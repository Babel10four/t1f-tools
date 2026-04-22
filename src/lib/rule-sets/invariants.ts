import type { RuleType } from "./constants";

type RowLite = {
  id: string;
  ruleType: RuleType;
  status: "draft" | "published" | "archived";
};

/**
 * IDs of rows that must be archived when publishing a draft of `ruleType`
 * (all currently `published` rows for that type — cross-type isolation).
 */
export function publishedRowIdsToArchiveForPublish(
  draft: { ruleType: RuleType },
  allRows: RowLite[],
): string[] {
  return allRows
    .filter(
      (r) => r.ruleType === draft.ruleType && r.status === "published",
    )
    .map((r) => r.id);
}

/**
 * IDs of rows to archive before rollback re-publishes `target` (current published for same rule_type).
 */
export function publishedRowIdsToArchiveForRollback(
  target: { ruleType: RuleType; id: string },
  allRows: RowLite[],
): string[] {
  return allRows
    .filter(
      (r) =>
        r.ruleType === target.ruleType &&
        r.status === "published" &&
        r.id !== target.id,
    )
    .map((r) => r.id);
}
