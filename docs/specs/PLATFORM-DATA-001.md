# PLATFORM-DATA-001 — Shared storage / schema alignment (addendum)

**Status:** draft (data-model addendum)  
**Last updated:** 2026-04-18  
**Scope:** Narrow alignment layer for **CONTENT-001**, **CONFIG-001**, **ANALYTICS-001**, **CONTENT-002** — not a redesign of deal tools or **`POST /api/deal/analyze`**.

**Depends on conceptually:** ACCESS-001 / ADMIN-001 (access + shell foundation).

**Non-goals:** Full CMS, compliance workflow engine, named-user identity model, vector search design, per-user audit trails.

---

## 1. Goals

- **One** coherent model for **documents**, **rule sets**, **tool bindings**, and **events** so tickets do not invent incompatible tables or versioning rules.  
- **CONTENT-002** can resolve “what is live for tool X?” without tools reading **raw latest upload** by default.  
- Compatible with **shared-password / role** access (e.g. `admin` | `rep` | `anonymous`) — store **role label** and **session id**, not PII.

---

## 2. Data entities and fields (logical)

### 2.1 `documents` (uploaded PDFs and similar blobs)

| Field | Type | Notes |
|--------|------|--------|
| `id` | UUID / bigserial | Primary key |
| `storage_key` | string | Path or key in **object storage** (see [§6](#6-what-lives-in-object-storage-vs-database)) |
| `content_type` | string | e.g. `application/pdf` |
| `byte_size` | bigint | Optional |
| `original_filename` | string | Optional; display only |
| `status` | enum | `draft` \| `published` \| `archived` |
| `created_at` | timestamptz | Upload / record creation |
| `published_at` | timestamptz | Nullable; set when transitioning to `published` |
| `effective_date` | date | Optional; when content is *intended* to apply (policy/display), not necessarily `published_at` |
| `archived_at` | timestamptz | Nullable; set when `archived` |
| `created_by_role` | string | Optional; e.g. `admin` — **not** a user id |
| `notes` | text | Optional internal note |

**Binary bytes** live in **object storage** only; DB holds metadata + pointer.

---

### 2.2 `rule_sets` (structured runtime rules: rates, calculator inputs, rural rules, JSON/YAML payloads)

| Field | Type | Notes |
|--------|------|--------|
| `id` | UUID / bigserial | Primary key |
| `kind` | string | Discriminator: e.g. `rates`, `calculator`, `rural`, `generic` |
| `version_label` | string | Optional human label (`v3`, `2026-Q2`) — **not** the sole source of truth for resolution |
| `payload` | jsonb | Canonical structured rules **or** small inline doc; large blobs may be `storage_key` instead |
| `payload_storage_key` | string | Nullable; if rules body lives in object storage |
| `source_document_id` | FK → `documents.id` | **Nullable** — optional provenance (“parsed from this PDF”) |
| `status` | enum | `draft` \| `published` \| `archived` |
| `created_at` | timestamptz | |
| `published_at` | timestamptz | Nullable |
| `effective_date` | date | Optional; effective for business logic resolution |
| `archived_at` | timestamptz | Nullable |
| `created_by_role` | string | Optional |

---

### 2.3 `tool_context_bindings` (what each tool uses in production)

**Purpose:** Map **`tool_key`** + **binding type** → **published** document and/or rule set **without** tools scanning “latest row.”

| Field | Type | Notes |
|--------|------|--------|
| `id` | UUID / bigserial | Primary key |
| `tool_key` | string | Stable id: e.g. `deal_analyze`, `loan_structuring`, `rural_checker` |
| `binding_type` | string | e.g. `primary_doc`, `rules`, `supplemental_doc` |
| `document_id` | FK → `documents.id` | Nullable |
| `rule_set_id` | FK → `rule_sets.id` | Nullable |
| `status` | enum | Only **`published`** bindings participate in resolution for tools; use `draft` for staging a swap; `archived` for history |
| `published_at` | timestamptz | When this binding became active |
| `superseded_by_binding_id` | FK → self | Nullable; rollback / lineage |
| `created_at` | timestamptz | |
| `created_by_role` | string | Optional |

**Invariant (CONTENT-002):** At most **one** active **`published`** binding per `(tool_key, binding_type)` for resolution (enforce in app or partial unique index where `status = 'published'`).

---

### 2.4 `events` (analytics / admin KPIs)

| Field | Type | Notes |
|--------|------|--------|
| `id` | UUID / bigserial | Primary key |
| `event_type` | string | e.g. `tool_open`, `analyze_submit`, `config_resolve` |
| `tool_key` | string | Nullable if global |
| `role` | string | From session / shared-password context |
| `session_id` | string | Opaque id from ACCESS-001 session |
| `route` | string | URL path or logical route key |
| `status` | string | e.g. `ok`, `error`, `4xx`, `5xx` — keep short |
| `metadata` | jsonb | Freeform; **no** PII by policy |
| `created_at` | timestamptz | Server time |

**Optional:** `request_id` (correlation) as string — if ANALYTICS-001 needs it.

---

## 3. Status model and publish / rollback rules

**Enum values:** `draft` → `published` → `archived` (documents and rule_sets); bindings use the same vocabulary with resolution semantics below.

| Transition | Meaning |
|------------|---------|
| **draft** | Not visible to production tool resolvers; may be edited/replaced freely. |
| **published** | Eligible for **CONTENT-002** resolution when referenced by a **`published`** `tool_context_binding` (or direct policy TBD per ticket — **prefer bindings**). |
| **archived** | Immutable snapshot; no longer selectable for *new* publishes; existing historical bindings may still point to archived rows for audit (or forbid — **pick one** in CONTENT-001: recommend **allow FK for history**, block new publishes). |

**Publish (documents / rule_sets):**

1. Set `status = published`, `published_at = now()`, optional `effective_date`.  
2. Create or update a **`tool_context_binding`** row with `status = published` pointing to this entity.  
3. Optionally **supersede** prior binding: set old binding `status = archived`, link `superseded_by_binding_id` to the new binding.

**Rollback:**

1. Activate a **previous published** document/rule version (must still exist and not be deleted from storage).  
2. Insert a **new** `tool_context_binding` row `published` pointing to that version; supersede current.  
3. Do **not** delete rows; **archive** superseded bindings.

**Tools never read “latest upload”** by `created_at` alone — only **published** chain via bindings (see [§7](#7-resolver-rules-content-002)).

---

## 4. Relationships (summary)

- **`rule_sets.source_document_id` → `documents`** — optional provenance.  
- **`tool_context_bindings`** — join surface for “active published” **per tool** and **binding_type**.  
- **Events** are **append-only**; no FK to documents/rule_sets required unless you add optional `metadata.document_id` later.

---

## 5. Minimal audit fields (cross-cutting)

| Field | Where | Use |
|--------|--------|-----|
| `created_at` | All entities | Insert time |
| `published_at` | documents, rule_sets, bindings | When published |
| `effective_date` | documents, rule_sets | Optional business-effective date |
| `archived_at` | documents, rule_sets | When archived |
| `created_by_role` | documents, rule_sets, bindings | Session role — **not** user id |
| Session context | `events` only | `session_id`, `role` for analytics |

**No full CMS audit trail** — extend later if needed.

---

## 6. What lives in object storage vs database

| Asset | Object storage | Database |
|--------|----------------|----------|
| PDF bytes | ✅ | Metadata + `storage_key` only |
| Large JSON/YAML rule files | ✅ optional | Prefer jsonb for small/medium rules; `payload_storage_key` if large |
| Event stream | ❌ | ✅ `events` table (or future columnar store — out of scope) |
| Binding pointers | ❌ | ✅ `tool_context_bindings` |

---

## 7. Resolver rules (CONTENT-002)

1. **Tools read only `published`** documents / rule_sets **as selected by** a **`published`** `tool_context_binding` for their `tool_key` (+ `binding_type`).  
2. **Default path:** resolve `tool_key` + `binding_type` → single active binding → entity id → load payload/metadata.  
3. **Do not** read “newest `documents` row by `created_at`” for production.  
4. **Draft** content is invisible to production resolvers unless explicitly wired in **non-prod** environments (env flag — separate from this addendum).  
5. **Deal tools** and **`/api/deal/analyze`** remain **unchanged** by this doc; future wiring consumes **published** config via **resolver** when CONFIG/CONTENT tickets implement it.

---

## 8. Analytics event shape (ANALYTICS-001)

Canonical JSON row shape (matches [§2.4](#24-events-analytics--admin-kpis)):

```json
{
  "event_type": "string",
  "tool_key": "string | null",
  "role": "string",
  "session_id": "string",
  "route": "string",
  "status": "string",
  "metadata": {},
  "created_at": "ISO-8601"
}
```

**Constraints:** No PII in `metadata` by convention; `session_id` opaque.

---

## 9. Migration order (recommendations)

| Order | Ticket | Rationale |
|-------|--------|-------------|
| 1 | **CONTENT-001** | Tables for `documents` + status + storage pointers; establishes upload/publish pipeline. |
| 2 | **CONFIG-001** | `rule_sets` + kinds; can reference `documents` optionally. |
| 3 | **ANALYTICS-001** | `events` table; independent read path; no blocker on content. |
| 4 | **CONTENT-002** | `tool_context_bindings` + resolver logic **after** documents and rule_sets exist and publish flow is stable. |

**Note:** If CONFIG must go live before PDFs, still create **`documents`** table empty and ship **rule_sets** first — but **bindings** should wait until at least one publishable entity exists per tool.

---

## 10. Entity / table plan (summary)

| Table | Purpose |
|-------|---------|
| `documents` | PDF metadata + lifecycle |
| `rule_sets` | Structured rules + lifecycle + optional `source_document_id` |
| `tool_context_bindings` | Published pointers per `tool_key` / `binding_type` |
| `events` | Analytics |

**Indexes (minimal):** `events(created_at)`, `events(tool_key, created_at)`, `tool_context_bindings(tool_key, binding_type)` where `status = 'published'`, FK indexes as usual.

---

## 11. Definition of done

- [ ] This addendum reviewed against **CONTENT-001**, **CONFIG-001**, **ANALYTICS-001**, **CONTENT-002** — no conflicting table or status semantics.  
- [ ] **Published vs draft** resolution path documented for tools (**bindings**, not “latest upload”).  
- [ ] **Storage split** agreed: blobs in object storage, metadata + bindings + events in DB.  
- [ ] **Event** shape matches ANALYTICS-001 admin/KPI needs.  
- [ ] **Migration order** accepted or adjusted with explicit rationale.  
- [ ] **Deal engine** and **`/api/deal/analyze`** contract explicitly **out of scope** for this alignment (no breaking changes assumed).
