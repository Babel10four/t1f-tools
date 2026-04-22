/**
 * CREDIT-DATA-001 — publish tool binding: credit_copilot + credit_policy_document
 * pointing at the currently published governed Credit Policy PDF (doc_type credit_policy).
 *
 * This is **initial binding setup only** — not retrieval or Q&A logic. Run **after** Architect
 * ships Credit Copilot (docs/specs/TICKET-009.md) and **before** end-to-end QA if the binding
 * is not already created manually in `/admin/bindings`.
 *
 * Credit Copilot must resolve policy via CONTENT-002 (`resolveToolBinding`), not "latest upload"
 * or raw storage queries. DATA-001 seeds the document only; this script adds the binding.
 *
 * Usage:
 *   npm run data:credit-001
 *   npm run data:credit-001 -- --dry-run
 *
 * Requires: DATABASE_URL (except --dry-run without resolution).
 *
 * @see docs/specs/CREDIT-DATA-001.md
 */
import type { BindingTypeV1 } from "../src/db/schema";
import {
  insertBindingDraft,
  listToolBindings,
  publishBinding,
} from "../src/lib/bindings/service";
import { listDocuments } from "../src/lib/documents/service";

/** Matches DATA-001 seed notes — preferred when multiple published rows exist (unlikely). */
const SEED_CREDIT_DATA_001 = "DATA-001 seed credit_policy";

const CREDIT_COPILOT = "credit_copilot" as const;
const BINDING: BindingTypeV1 = "credit_policy_document";

function dryRun(): boolean {
  return process.argv.includes("--dry-run");
}

async function publishedBindingExists(
  toolKey: string,
  bindingType: BindingTypeV1,
): Promise<boolean> {
  const rows = await listToolBindings({ toolKey, status: "published" });
  return rows.some((r) => r.bindingType === bindingType);
}

/**
 * Picks the published credit_policy document the tool should use:
 * - Prefer a row whose notes include the DATA-001 seed (governed initial load).
 * - Else the most recently published (by publishedAt).
 */
async function resolvePublishedCreditPolicyDocumentId(): Promise<
  string | undefined
> {
  const docs = await listDocuments();
  const published = docs.filter(
    (d) => d.docType === "credit_policy" && d.status === "published",
  );
  if (published.length === 0) {
    return undefined;
  }
  const preferred = published.find((d) =>
    d.notes?.includes(SEED_CREDIT_DATA_001),
  );
  if (preferred) {
    return preferred.id;
  }
  published.sort((a, b) => {
    const ta = a.publishedAt?.getTime() ?? 0;
    const tb = b.publishedAt?.getTime() ?? 0;
    return tb - ta;
  });
  return published[0]?.id;
}

async function ensureDocumentBinding(
  toolKey: string,
  bindingType: BindingTypeV1,
  documentId: string,
): Promise<void> {
  if (await publishedBindingExists(toolKey, bindingType)) {
    console.log(
      `[skip] Published binding ${toolKey} + ${bindingType} already exists.`,
    );
    return;
  }

  const draft = await insertBindingDraft({
    toolKey,
    bindingType,
    documentId,
    ruleSetId: null,
    createdByRole: "admin",
  });
  await publishBinding(draft.id);
  console.log(`[ok] Published binding ${toolKey} + ${bindingType} id=${draft.id}`);
}

async function main(): Promise<void> {
  const dr = dryRun();

  if (dr && !process.env.DATABASE_URL) {
    console.log("CREDIT-DATA-001 dry run — no database writes.");
    console.log("(DATABASE_URL unset — cannot resolve published credit_policy id)");
    console.log(
      "Would create published binding: credit_copilot + credit_policy_document → published credit_policy document.",
    );
    return;
  }

  if (!dr && !process.env.DATABASE_URL) {
    console.error(
      "DATABASE_URL is required (omit --dry-run only after configuring env).",
    );
    process.exit(1);
  }

  if (dr) {
    console.log("CREDIT-DATA-001 dry run — no database writes.");
  }

  const docId = await resolvePublishedCreditPolicyDocumentId();
  if (!docId) {
    console.error(
      "No published credit_policy document found. Upload/publish via /admin/documents or run DATA-001 (npm run data:001) first.",
    );
    process.exit(1);
  }

  if (dr) {
    console.log(`Would bind to published credit_policy document id=${docId}`);
    if (await publishedBindingExists(CREDIT_COPILOT, BINDING)) {
      console.log(
        `[skip] Published binding ${CREDIT_COPILOT} + ${BINDING} already exists.`,
      );
    }
    return;
  }

  await ensureDocumentBinding(CREDIT_COPILOT, BINDING, docId);
  console.log("CREDIT-DATA-001 complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
