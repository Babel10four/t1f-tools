# BUILD SPEC — CONTENT-001

**Status:** approved  
**Last updated:** 2026-04-18  
**Depends on:** [`ACCESS-001`](./ACCESS-001.md), [`ADMIN-001`](./ADMIN-001.md)  
**Parent:** [`PLATFORM-PATH-A.md`](./PLATFORM-PATH-A.md)

---

## Objective

**Admin document library** for **PDFs** that are **source-of-truth references** (credit policy, rural policy, guidance, Q&A corpora). Support **upload → classify → parse/extract → review → publish** with **draft / published / archived** and **rollback**.

**Runtime calculators must not read raw PDFs directly** — published artifacts feed **structured rule sets** (**CONFIG-001**) and **tool context** (**CONTENT-002**).

---

## Data model: `documents`

| Field | Notes |
|-------|--------|
| `id` | UUID |
| `doc_type` | e.g. `credit_policy`, `rural_policy`, `reference_guidance` |
| `title` | Display |
| `version_label` | Human-readable |
| `effective_date` | Optional |
| `status` | `draft` \| `published` \| `archived` |
| `storage_path` | Blob/object storage key |
| `extracted_text` | Post-parse text (for review / search / optional RAG later) |
| `uploaded_at` | Timestamp |
| `published_at` | Nullable |

**Storage:** Postgres row + **object storage** for PDF bytes (not Airtable as SoT).

---

## Admin workflow

1. Upload PDF  
2. Set **doc_type**, title, version, effective date  
3. Trigger **parse/extract** (implementation can be v1-simple: store file + async text extraction)  
4. **Review** screen  
5. **Publish** → status `published`; previous published version of same logical doc may be **archived** or versioned per product rules  
6. **Rollback** — repoint “current published” to a prior version or restore archived  

**Tools must use published + structured downstreams**, not “latest upload only.”

---

## APIs

- **Admin-only** mutations: upload, update metadata, publish, archive, rollback.  
- **Read APIs** for tools/services should expose **published** document metadata and **extracted text** only as needed — **not** bypass CONFIG for numeric runtime rules.

---

## Definition of done

- [x] CRUD + lifecycle for `documents` in Postgres + blob storage.  
- [x] `/admin/documents` functional for upload → publish path.  
- [x] Published vs draft clearly enforced for **consumer** queries (bindings deferred to CONTENT-002).  

**Shipped implementation notes:** See repo README (CONTENT-001). Metadata fields align with [`PLATFORM-DATA-001`](./PLATFORM-DATA-001.md) (`storage_key`, `created_by_role`, `archived_at`, etc.). `uploaded_at` in this spec maps to `created_at` in the DB.  
