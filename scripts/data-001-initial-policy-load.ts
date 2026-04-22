/**
 * DATA-001 — load initial published policy PDFs, rule_sets, and deal_engine bindings.
 *
 * Requires: DATABASE_URL, and either BLOB_READ_WRITE_TOKEN (production) or local `.local-documents/` (dev).
 *
 * Usage:
 *   CREDIT_POLICY_PDF=/path/to/credit.pdf RURAL_POLICY_PDF=/path/to/rural.pdf npm run data:001
 *   npm run data:001 -- --dry-run
 *
 * Default PDF paths (override with env):
 *   ~/Downloads/Tier One Funding Credit Policy ver. 10.30.2025 (6).pdf
 *   ~/Downloads/Rural Property Identification.pdf
 *
 * @see docs/specs/DATA-001.md
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
import { putPdfBytes } from "../src/lib/storage/document-storage";
import {
  POLICY_CTC_CLOSING_COSTS_PCT,
  POLICY_CTC_LENDER_FEES_PCT,
  POLICY_CTC_POINTS_PCT,
  POLICY_DEFAULT_TERM_MONTHS,
  POLICY_LTV_OVER_LIMIT_THRESHOLD_PCT,
  POLICY_MAX_ARV_LTV_PCT,
  POLICY_MAX_LTC_PCT,
  POLICY_REFINANCE_MAX_LTV_PCT,
} from "../src/lib/engines/deal/policy/constants";
import type { ValidatedPayload } from "../src/lib/rule-sets/validate-payload";

const SEED_CREDIT = "DATA-001 seed credit_policy";
const SEED_RURAL = "DATA-001 seed rural_policy";

const DEFAULT_CREDIT_PDF = join(
  homedir(),
  "Downloads",
  "Tier One Funding Credit Policy ver. 10.30.2025 (6).pdf",
);
const DEFAULT_RURAL_PDF = join(
  homedir(),
  "Downloads",
  "Rural Property Identification.pdf",
);

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

async function uploadPublishPdf(input: {
  path: string;
  docType: DocumentType;
  title: string;
  versionLabel: string;
  effectiveDate: string | null;
  notesSeed: string;
}): Promise<string> {
  const existing = await findPublishedDocBySeed(input.docType, input.notesSeed);
  if (existing) {
    console.log(
      `[skip] Published ${input.docType} already seeded (${existing}) — not re-uploading.`,
    );
    return existing;
  }

  const buf = await readFile(input.path);
  if (!isLikelyPdf(buf)) {
    throw new Error(`Not a PDF: ${input.path}`);
  }

  const id = randomUUID();
  const { storageKey } = await putPdfBytes(id, buf);
  const extractedText = await extractPdfTextBestEffort(buf);

  const row = await insertDocument({
    id,
    seriesId: randomUUID(),
    docType: input.docType,
    title: input.title,
    versionLabel: input.versionLabel,
    effectiveDate: input.effectiveDate,
    storageKey,
    byteSize: buf.length,
    originalFilename: input.path.split(/[/\\]/).pop() ?? "upload.pdf",
    extractedText,
    notes: `${input.notesSeed} — loaded by scripts/data-001-initial-policy-load.ts`,
    createdByRole: "admin",
  });

  await publishDocument(row.id);
  console.log(`[ok] Published document ${input.docType} id=${row.id}`);
  return row.id;
}

function buildRatesPayload() {
  const raw = {
    schemaVersion: 1 as const,
    rateTables: [
      {
        id: "bridge_indicative_v1",
        label: "Bridge (indicative — update with production pricing)",
        rows: [{ term: "12m", rate: 8.5 }],
      },
    ],
    noteRatePercent: null,
    marginBps: null,
    discountPoints: null,
    lockDays: null,
  };
  const v = validateRulePayload("rates", raw);
  if (!v.ok) {
    throw new Error(`rates payload invalid: ${v.error}`);
  }
  return v.payload;
}

function buildCalculatorPayload() {
  const raw = {
    schemaVersion: 1 as const,
    assumptions: {
      maxLtcPct: POLICY_MAX_LTC_PCT,
      maxArvLtvPct: POLICY_MAX_ARV_LTV_PCT,
      refinanceMaxLtvPct: POLICY_REFINANCE_MAX_LTV_PCT,
      defaultTermMonths: POLICY_DEFAULT_TERM_MONTHS,
      ltvOverLimitThresholdPct: POLICY_LTV_OVER_LIMIT_THRESHOLD_PCT,
      ctcPointsPct: POLICY_CTC_POINTS_PCT,
      ctcLenderFeesPct: POLICY_CTC_LENDER_FEES_PCT,
      ctcClosingCostsPct: POLICY_CTC_CLOSING_COSTS_PCT,
    },
  };
  const v = validateRulePayload("calculator_assumptions", raw);
  if (!v.ok) {
    throw new Error(`calculator_assumptions payload invalid: ${v.error}`);
  }
  return v.payload;
}

async function ensurePublishedRuleSet(
  ruleType: "rates" | "calculator_assumptions",
  versionLabel: string,
  jsonPayload: ValidatedPayload,
): Promise<string> {
  const existing = await getPublishedRuleSetByType(ruleType);
  if (existing) {
    console.log(
      `[skip] Published ${ruleType} already exists (${existing.id}) — not creating a new row.`,
    );
    return existing.id;
  }

  const id = randomUUID();
  await insertRuleSet({
    id,
    seriesId: randomUUID(),
    ruleType,
    versionLabel,
    effectiveDate: null,
    jsonPayload,
    sourceDocumentId: null,
    createdByRole: "admin",
  });
  await publishRuleSet(id);
  console.log(`[ok] Published rule_set ${ruleType} id=${id}`);
  return id;
}

async function ensureBinding(
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

async function main(): Promise<void> {
  const dr = dryRun();
  const creditPath =
    process.env.CREDIT_POLICY_PDF?.trim() || DEFAULT_CREDIT_PDF;
  const ruralPath = process.env.RURAL_POLICY_PDF?.trim() || DEFAULT_RURAL_PDF;

  if (dr) {
    console.log("Dry run — no database writes.");
    if (!process.env.DATABASE_URL) {
      console.log("(DATABASE_URL unset — OK for --dry-run)");
    }
    console.log("Would read PDFs:", creditPath, ruralPath);
    for (const p of [creditPath, ruralPath]) {
      try {
        const b = await readFile(p);
        console.log(`  ${p}: ${b.length} bytes, PDF=${isLikelyPdf(b)}`);
      } catch (e) {
        console.log(`  ${p}: ERROR ${e instanceof Error ? e.message : e}`);
      }
    }
    console.log("Would create/publish rule_sets and deal_engine bindings if absent.");
    return;
  }

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required (omit --dry-run only after configuring env).");
    process.exit(1);
  }

  await uploadPublishPdf({
    path: creditPath,
    docType: "credit_policy",
    title: "Tier One Funding Credit Policy",
    versionLabel: "ver. 10.30.2025",
    effectiveDate: "2025-10-30",
    notesSeed: SEED_CREDIT,
  });

  await uploadPublishPdf({
    path: ruralPath,
    docType: "rural_policy",
    title: "Rural Property Identification",
    versionLabel: "v1 (PDF)",
    effectiveDate: null,
    notesSeed: SEED_RURAL,
  });

  const ratesPayload = buildRatesPayload();
  const calcPayload = buildCalculatorPayload();

  const ratesId = await ensurePublishedRuleSet(
    "rates",
    "DATA-001 initial",
    ratesPayload,
  );
  const calcId = await ensurePublishedRuleSet(
    "calculator_assumptions",
    "DATA-001 initial (embedded engine defaults)",
    calcPayload,
  );

  await ensureBinding("deal_engine", "rates_rule_set", ratesId);
  await ensureBinding(
    "deal_engine",
    "calculator_assumptions_rule_set",
    calcId,
  );

  console.log("DATA-001 complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
