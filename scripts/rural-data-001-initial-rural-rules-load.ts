/**
 * RURAL-DATA-001 — publish structured `rural_rules` and bind `rural_checker` to:
 *   - rural_rules_rule_set (required for Rural Checker evaluation — TICKET-008)
 *   - rural_policy_document (metadata only; PDF is not evaluated at runtime)
 *
 * Requires: DATABASE_URL, and either BLOB_READ_WRITE_TOKEN or local `.local-documents/` when uploading PDF.
 *
 * Usage:
 *   RURAL_POLICY_PDF=/path/to/rural.pdf npm run data:rural-001
 *   npm run data:rural-001 -- --dry-run
 *
 * If a published `rural_policy` doc already exists from DATA-001 (notes contain `DATA-001 seed rural_policy`),
 * it is reused. Otherwise uploads from RURAL_POLICY_PDF (default: ~/Downloads/Rural Property Identification.pdf).
 *
 * Seed `evaluation` matches test fixtures (structural correctness). Before production, verify thresholds
 * against the governed Rural Property Identification PDF — see docs/specs/RURAL-DATA-001.md.
 *
 * @see docs/specs/RURAL-DATA-001.md
 */
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { BindingTypeV1 } from "../src/db/schema";
import {
  insertBindingDraft,
  listToolBindings,
  publishBinding,
} from "../src/lib/bindings/service";
import type { DocumentType } from "../src/lib/documents/constants";
import { extractPdfTextBestEffort } from "../src/lib/documents/extract-text";
import { isLikelyPdf } from "../src/lib/documents/pdf";
import { insertDocument, listDocuments, publishDocument } from "../src/lib/documents/service";
import {
  getPublishedRuleSetByType,
  insertRuleSet,
  publishRuleSet,
} from "../src/lib/rule-sets/service";
import { validateRulePayload } from "../src/lib/rule-sets/validate-payload";
import type { ValidatedPayload } from "../src/lib/rule-sets/validate-payload";
import { putPdfBytes } from "../src/lib/storage/document-storage";

/** Prefer this seed after RURAL-DATA-001; DATA-001 seed still recognized for reuse. */
const SEED_RURAL_DOC_RURAL_DATA_001 = "RURAL-DATA-001 seed rural_policy";
const SEED_RURAL_DOC_DATA_001 = "DATA-001 seed rural_policy";

const DEFAULT_RURAL_PDF = join(
  homedir(),
  "Downloads",
  "Rural Property Identification.pdf",
);

const RURAL_CHECKER = "rural_checker" as const;

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

async function findPublishedDocBySeed(
  docType: DocumentType,
  seed: string,
): Promise<string | undefined> {
  const docs = await listDocuments();
  const hit = docs.find(
    (d) =>
      d.docType === docType &&
      d.status === "published" &&
      d.notes?.includes(seed),
  );
  return hit?.id;
}

/**
 * Initial evaluation block aligned with TICKET-008 tests and `validateRulePayload("rural_rules")`.
 * Capital should replace published JSON when policy changes — screening stays deterministic from JSON.
 */
function buildRuralRulesPayload(): ValidatedPayload {
  const raw = {
    schemaVersion: 1 as const,
    evaluation: {
      version: 1 as const,
      population: {
        likelyRuralIfLte: 50_000,
        likelyNotRuralIfGte: 250_000,
        scoreIfRuralLean: 2,
        scoreIfNotRuralLean: -2,
        scoreIfBetween: 0,
        scoreIfMissing: 0,
      },
      msa: {
        likelyNotRuralIfTrue: true,
        scoreIfInMsaPenalty: -2,
        scoreIfInMsaNoPenalty: 0,
        scoreIfNotInMsa: 1,
        scoreIfMissing: 0,
      },
      userRuralIndicator: {
        likelyRuralIfTrue: true,
        scoreIfTrue: 1,
        scoreIfFalse: -1,
        scoreIfMissing: 0,
      },
      scores: {
        likelyRuralMin: 2,
        likelyNotRuralMax: -1,
        needsReviewBandMin: -1,
        needsReviewBandMax: 1,
      },
    },
    rules: [] as { id: string; description?: string; threshold?: number }[],
  };
  const v = validateRulePayload("rural_rules", raw);
  if (!v.ok) {
    throw new Error(`rural_rules payload invalid: ${v.error}`);
  }
  return v.payload;
}

async function ensurePublishedRuralRules(jsonPayload: ValidatedPayload): Promise<string> {
  const existing = await getPublishedRuleSetByType("rural_rules");
  if (existing) {
    console.log(
      `[skip] Published rural_rules already exists (${existing.id}) — not creating a new row.`,
    );
    return existing.id;
  }

  const id = randomUUID();
  await insertRuleSet({
    id,
    seriesId: randomUUID(),
    ruleType: "rural_rules",
    versionLabel: "RURAL-DATA-001 initial (structured evaluation)",
    effectiveDate: null,
    jsonPayload,
    sourceDocumentId: null,
    createdByRole: "admin",
  });
  await publishRuleSet(id);
  console.log(`[ok] Published rule_set rural_rules id=${id}`);
  return id;
}

async function ensureRuleSetBinding(
  toolKey: string,
  bindingType: BindingTypeV1,
  ruleSetId: string,
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
    documentId: null,
    ruleSetId,
    createdByRole: "admin",
  });
  await publishBinding(draft.id);
  console.log(`[ok] Published binding ${toolKey} + ${bindingType} id=${draft.id}`);
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

async function resolveRuralPolicyDocumentId(ruralPdfPath: string): Promise<string> {
  let id = await findPublishedDocBySeed("rural_policy", SEED_RURAL_DOC_RURAL_DATA_001);
  if (id) {
    console.log(
      `[skip] Published rural_policy already seeded (${id}) — RURAL-DATA-001 — not re-uploading.`,
    );
    return id;
  }
  id = await findPublishedDocBySeed("rural_policy", SEED_RURAL_DOC_DATA_001);
  if (id) {
    console.log(
      `[skip] Published rural_policy from DATA-001 (${id}) — reusing for rural_checker binding.`,
    );
    return id;
  }

  const buf = await readFile(ruralPdfPath);
  if (!isLikelyPdf(buf)) {
    throw new Error(`Not a PDF: ${ruralPdfPath}`);
  }

  const docId = randomUUID();
  const { storageKey } = await putPdfBytes(docId, buf);
  const extractedText = await extractPdfTextBestEffort(buf);

  const row = await insertDocument({
    id: docId,
    seriesId: randomUUID(),
    docType: "rural_policy",
    title: "Rural Property Identification",
    versionLabel: "v1 (PDF)",
    effectiveDate: null,
    storageKey,
    byteSize: buf.length,
    originalFilename: ruralPdfPath.split(/[/\\]/).pop() ?? "rural.pdf",
    extractedText,
    notes: `${SEED_RURAL_DOC_RURAL_DATA_001} — loaded by scripts/rural-data-001-initial-rural-rules-load.ts`,
    createdByRole: "admin",
  });

  await publishDocument(row.id);
  console.log(`[ok] Published document rural_policy id=${row.id}`);
  return row.id;
}

async function main(): Promise<void> {
  const dr = dryRun();
  const ruralPath =
    process.env.RURAL_POLICY_PDF?.trim() || DEFAULT_RURAL_PDF;

  if (dr) {
    console.log("RURAL-DATA-001 dry run — no database writes.");
    if (!process.env.DATABASE_URL) {
      console.log("(DATABASE_URL unset — OK for --dry-run)");
    }
    console.log("Would ensure published rural_rules + rural_checker bindings.");
    console.log("Would use rural PDF if no published rural_policy doc exists:", ruralPath);
    try {
      const b = await readFile(ruralPath);
      console.log(`  ${ruralPath}: ${b.length} bytes, PDF=${isLikelyPdf(b)}`);
    } catch (e) {
      console.log(
        `  ${ruralPath}: ERROR ${e instanceof Error ? e.message : e} (needed only if upload required)`,
      );
    }
    return;
  }

  if (!process.env.DATABASE_URL) {
    console.error(
      "DATABASE_URL is required (omit --dry-run only after configuring env).",
    );
    process.exit(1);
  }

  const ruralPayload = buildRuralRulesPayload();
  const rulesId = await ensurePublishedRuralRules(ruralPayload);

  const policyDocId = await resolveRuralPolicyDocumentId(ruralPath);

  await ensureRuleSetBinding(RURAL_CHECKER, "rural_rules_rule_set", rulesId);
  await ensureDocumentBinding(RURAL_CHECKER, "rural_policy_document", policyDocId);

  console.log("RURAL-DATA-001 complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
