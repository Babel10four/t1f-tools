import {
  bigint,
  date,
  foreignKey,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type {
  BorrowerSnapshot,
  CompetitorParsed,
  IntelSource,
  PropertyDossier,
} from "@/lib/intel/types";

/** PDF library metadata — bytes live in object storage (`storage_key`). */
export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  seriesId: uuid("series_id").notNull(),
  docType: text("doc_type").notNull(),
  title: text("title").notNull(),
  versionLabel: text("version_label").notNull(),
  effectiveDate: date("effective_date", { mode: "string" }),
  status: text("status").notNull().$type<"draft" | "published" | "archived">(),
  storageKey: text("storage_key").notNull(),
  contentType: text("content_type").notNull().default("application/pdf"),
  byteSize: bigint("byte_size", { mode: "number" }),
  originalFilename: text("original_filename"),
  extractedText: text("extracted_text"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdByRole: text("created_by_role"),
});

export type DocumentRow = typeof documents.$inferSelect;
export type DocumentInsert = typeof documents.$inferInsert;

/** CONFIG-001 — structured runtime config; json_payload schema-validated per rule_type. */
export const ruleSets = pgTable("rule_sets", {
  id: uuid("id").primaryKey().defaultRandom(),
  seriesId: uuid("series_id").notNull(),
  ruleType: text("rule_type")
    .notNull()
    .$type<"rates" | "calculator_assumptions" | "rural_rules">(),
  versionLabel: text("version_label").notNull(),
  effectiveDate: date("effective_date", { mode: "string" }),
  status: text("status").notNull().$type<"draft" | "published" | "archived">(),
  jsonPayload: jsonb("json_payload")
    .notNull()
    .$type<Record<string, unknown>>(),
  sourceDocumentId: uuid("source_document_id").references(() => documents.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdByRole: text("created_by_role"),
});

export type RuleSetRow = typeof ruleSets.$inferSelect;
export type RuleSetInsert = typeof ruleSets.$inferInsert;

/** ANALYTICS-001 — append-only usage events (Postgres source of truth). */
export const platformEvents = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventType: text("event_type").notNull(),
  toolKey: text("tool_key"),
  role: text("role").notNull(),
  sessionId: text("session_id").notNull(),
  route: text("route").notNull(),
  status: text("status").notNull().$type<"success" | "error">(),
  metadata: jsonb("metadata")
    .notNull()
    .$type<Record<string, unknown>>()
    .default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PlatformEventRow = typeof platformEvents.$inferSelect;
export type PlatformEventInsert = typeof platformEvents.$inferInsert;

/** CONTENT-002 — which published document/rule_set each tool uses (resolver authority). */
export const bindingTypesV1 = [
  "credit_policy_document",
  "rural_policy_document",
  "rates_rule_set",
  "calculator_assumptions_rule_set",
  "rural_rules_rule_set",
] as const;
export type BindingTypeV1 = (typeof bindingTypesV1)[number];

export const toolContextBindings = pgTable(
  "tool_context_bindings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    toolKey: text("tool_key").notNull(),
    bindingType: text("binding_type").notNull().$type<BindingTypeV1>(),
    documentId: uuid("document_id").references(() => documents.id, {
      onDelete: "restrict",
    }),
    ruleSetId: uuid("rule_set_id").references(() => ruleSets.id, {
      onDelete: "restrict",
    }),
    status: text("status").notNull().$type<"draft" | "published" | "archived">(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    /** Self-FK: explicit short name — Postgres max identifier length is 63 bytes. */
    supersededByBindingId: uuid("superseded_by_binding_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdByRole: text("created_by_role"),
  },
  (table) => [
    foreignKey({
      name: "tcb_superseded_by_fk",
      columns: [table.supersededByBindingId],
      foreignColumns: [table.id],
    }).onDelete("set null"),
  ],
);

export type ToolContextBindingRow = typeof toolContextBindings.$inferSelect;
export type ToolContextBindingInsert = typeof toolContextBindings.$inferInsert;

/**
 * INTEL-001 — Intelligence Layer (Firecrawl + GPT). Permanent store for borrower snapshots,
 * property dossiers, and competitor snapshots. `*_payload` JSONB holds the typed shapes from
 * `@/lib/intel/types`; `sources` records provenance (which URLs the facts came from).
 */
export const intelBorrowerSnapshots = pgTable("intel_borrower_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  borrowerName: text("borrower_name").notNull(),
  entityName: text("entity_name"),
  website: text("website"),
  snapshot: jsonb("snapshot").notNull().$type<BorrowerSnapshot>(),
  sources: jsonb("sources").notNull().$type<IntelSource[]>().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type IntelBorrowerSnapshotRow = typeof intelBorrowerSnapshots.$inferSelect;
export type IntelBorrowerSnapshotInsert = typeof intelBorrowerSnapshots.$inferInsert;

export const intelPropertyDossiers = pgTable("intel_property_dossiers", {
  id: uuid("id").primaryKey().defaultRandom(),
  address: text("address").notNull(),
  dossier: jsonb("dossier").notNull().$type<PropertyDossier>(),
  sources: jsonb("sources").notNull().$type<IntelSource[]>().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type IntelPropertyDossierRow = typeof intelPropertyDossiers.$inferSelect;
export type IntelPropertyDossierInsert = typeof intelPropertyDossiers.$inferInsert;

export const intelCompetitorSnapshots = pgTable("intel_competitor_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  competitor: text("competitor").notNull(),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
  rawMarkdown: text("raw_markdown"),
  parsed: jsonb("parsed").$type<CompetitorParsed>(),
  sourceUrl: text("source_url"),
});

export type IntelCompetitorSnapshotRow = typeof intelCompetitorSnapshots.$inferSelect;
export type IntelCompetitorSnapshotInsert = typeof intelCompetitorSnapshots.$inferInsert;
