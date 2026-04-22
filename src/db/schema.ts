import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  bigint,
  date,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

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

export const toolContextBindings = pgTable("tool_context_bindings", {
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
  supersededByBindingId: uuid("superseded_by_binding_id").references(
    (): AnyPgColumn => toolContextBindings.id,
    { onDelete: "set null" },
  ),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdByRole: text("created_by_role"),
});

export type ToolContextBindingRow = typeof toolContextBindings.$inferSelect;
export type ToolContextBindingInsert = typeof toolContextBindings.$inferInsert;
