# BUILD SPEC — CONFIG-001

**Status:** approved  
**Last updated:** 2026-04-18  
**Depends on:** [`ACCESS-001`](./ACCESS-001.md), [`ADMIN-001`](./ADMIN-001.md); pairs with [`CONTENT-001`](./CONTENT-001.md)  
**Parent:** [`PLATFORM-PATH-A.md`](./PLATFORM-PATH-A.md)

---

## Objective

**Structured runtime configuration** as the **source of truth** for numeric and rule-driven tool behavior. **PDFs inform** humans and extraction; **published `rule_sets`** drive **tool math** at runtime — **not** raw PDF retrieval.

**This is not a generic settings CMS.** v1 ships **only** the frozen **`rule_type`** kinds below, each with a **versioned JSON schema** and **publish lifecycle**. Do not add open-ended key-value “app settings” or arbitrary blobs without a new ticket.

---

## V1 `rule_type` kinds (frozen — Builder must implement exactly these three)

| `rule_type` | Runtime need | Purpose (v1) |
|-------------|----------------|---------------|
| **`rates`** | Interest rates change | Structured rate tables / indices the pricing and related surfaces consume. |
| **`calculator_assumptions`** | Deal calculator assumptions change | Numeric assumptions, caps, and inputs for deal/workflow calculators — **not** document text. |
| **`rural_rules`** | Rural logic changes | Structured rural eligibility / scoring rules (versioned JSON), separate from rural **policy PDFs** in **CONTENT-001**. |

- **No other `rule_type` values in v1** unless a follow-up spec explicitly extends this list.  
- **`json_payload`** must validate against the **documented JSON schema** for that `rule_type` (three schemas in v1).

---

## Data model: `rule_sets`

| Field | Notes |
|-------|--------|
| `id` | UUID |
| `rule_type` | **Enum:** **`rates`** \| **`calculator_assumptions`** \| **`rural_rules`** (v1 only) |
| `version_label` | Human-readable |
| `effective_date` | As needed for resolution |
| `status` | `draft` \| `published` \| `archived` |
| `json_payload` | JSON — **schema-validated per `rule_type`** |
| `source_document_id` | Optional FK to `documents` |
| `published_at` | Nullable |

---

## Publish flow

- Admin edits draft → **publish** → consumers resolve **latest published** `rule_set` per `rule_type` (plus effective-date rules as specified in implementation).  
- **Rollback** to a prior published version.  
- **Interest-rate changes** land in **`rates`** — not PDF text at runtime.  
- **Calculator assumption changes** land in **`calculator_assumptions`**.  
- **Rural logic changes** land in **`rural_rules`** — not ad-hoc PDF reads in calculator paths.

---

## APIs

- Admin-only: create/update/publish/rollback `rule_sets` for the three v1 kinds.  
- **Read path for tools:** **`tool_bindings`** resolution per **[CONTENT-002](./CONTENT-002.md)** (published-only, server-side; v1 **`rates_rule_set`**, **`calculator_assumptions_rule_set`**, **`rural_rules_rule_set`** bindings).

---

## Testing requirements (launch gate — not deferrable)

**Do not repeat CONTENT-001’s audit gap:** dedicated **service / lifecycle tests** are **required for CONFIG-001 from the start** (not P2).

Ship **automated tests** that cover at minimum:

1. **Service layer** — create draft → validate payload → publish → read resolved published config by `rule_type`.  
2. **Lifecycle** — draft not visible to “published-only” readers; after publish, readers see new version; **rollback** restores prior published behavior.  
3. **Invalid payload** — rejected at publish or save with clear errors (per-schema).  
4. **Cross-type isolation** — publishing **`rates`** does not alter **`calculator_assumptions`** resolution, etc.

Tests may live next to the config service module (e.g. `*.test.ts`) and **must** run in CI.

---

## Definition of done

- [x] `rule_sets` table with **`rule_type` constrained** to the three v1 values (or enforced in application + DB check).  
- [x] **Documented JSON schema** for **`rates`**, **`calculator_assumptions`**, and **`rural_rules`** — checked in CI or at build time where feasible.  
- [x] `/admin/rules` supports publish and rollback for each kind.  
- [x] **Service/lifecycle tests** above are **implemented and passing** — explicitly **not** “nice-to-have later.”  
- [x] No generic unvalidated settings bag; v1 scope stays **rates + calculator_assumptions + rural_rules** only.  

---

## CONFIG-001A (hardening — launch audit)

- **DB-backed lifecycle proof:** integration tests in `src/lib/rule-sets/service.lifecycle.integration.test.ts` run when `RULE_SETS_INTEGRATION_DATABASE_URL` is set (see repository **README** — Rule sets & runtime configuration). They exercise real `insertRuleSet` / `publishRuleSet` / `rollbackRuleSet` / `archiveRuleSet` against migrated schema.
- **Operator docs:** README covers migration order, `/admin/rules`, the three v1 `rule_type` values, and publish/rollback behavior.

---

## Non-goals (v1)

Arbitrary key-value app settings, user-editable JSON without schema, or a full CMS. Extending **`rule_type`** beyond the three frozen kinds.
