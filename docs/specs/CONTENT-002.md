# BUILD SPEC — CONTENT-002

**Status:** approved  
**Last updated:** 2026-04-18  
**Depends on:** [`CONTENT-001`](./CONTENT-001.md), [`CONFIG-001`](./CONFIG-001.md)  
**Parent:** [`PLATFORM-PATH-A.md`](./PLATFORM-PATH-A.md)

---

## Objective

**Server-side tool context resolver:** for each `tool_key`, resolve **which published documents and published rule sets** that tool is **bound** to — so runtime code never guesses from **latest upload**, **latest `created_at`**, or implicit defaults.

**Scope boundary (non-negotiable):** This ticket **does not** redesign live tool pages, **does not** rewrite deal-engine or analyze **math**, and **does not** change API contracts **unless** a separate spec explicitly says so. **CONTENT-002** adds **binding storage + server resolution + explicit missing states** only; wiring engines to consume resolver output may be a **follow-on** ticket with explicit diffs.

---

## Frozen decisions (non-negotiable)

| Decision | Rule |
|----------|------|
| **Published only** | Tools resolve **`status = published`** artifacts only. **Never** “latest upload,” **never** “newest row by `created_at`/`updated_at`,” **never** draft rows for runtime. |
| **Resolver location** | Resolution runs **server-side** (Route Handler, Server Action, or server-only module). **Not** in the browser; clients may **display** resolved ids/metadata returned by the server, but **must not** re-implement selection logic. |
| **Missing binding** | If a required binding is absent or points at nothing publishable, return an **explicit missing / unconfigured** state (typed error, structured flag, or `null` with **`reason`**) — **no silent fallback** to another document or “most recent.” |
| **Authority** | **Bindings** (per `tool_key`, per **v1 binding type** below) are the **only** authority for “what this tool currently uses.” No parallel “current config” in env vars, hardcoded ids, or ad hoc queries bypassing bindings. |

---

## V1 binding types (frozen)

These are the **only** `binding_type` values in v1 unless a follow-up spec extends the enum.

| `binding_type` | Resolves to | Must be |
|----------------|-------------|---------|
| **`credit_policy_document`** | Row in **`documents`** | `doc_type` compatible with credit policy; **`status = published`** |
| **`rural_policy_document`** | Row in **`documents`** | Rural/reference policy doc; **`status = published`** |
| **`rates_rule_set`** | Row in **`rule_sets`** | **`rule_type = rates`**; **`status = published`** |
| **`calculator_assumptions_rule_set`** | Row in **`rule_sets`** | **`rule_type = calculator_assumptions`**; **`status = published`** |
| **`rural_rules_rule_set`** | Row in **`rule_sets`** | **`rule_type = rural_rules`**; **`status = published`** |

Each `tool_key` may have **zero or one** row per `binding_type` (or product-defined cardinality — document explicitly if a tool needs multiple per type in a later ticket). Unconfigured slots are **explicit**, not implied.

---

## Data model (suggested)

Persist bindings in something like **`tool_bindings`**:

| Field | Notes |
|-------|--------|
| `tool_key` | Stable id (matches analytics / hub) |
| `binding_type` | One of the five v1 values above |
| `target_id` | UUID → **`documents.id`** or **`rule_sets.id`** (validated by `binding_type`) |
| `updated_at` | Audit only — **not** used for “latest wins” resolution |

**Resolution query:** join `target_id` → artifact table **where `status = published`** (and `rule_sets.rule_type` matches binding). If join fails → **missing/unconfigured** for that binding.

---

## Resolver behavior

1. **Input:** `tool_key` (and optionally caller role for future use).  
2. **Output:** For each `binding_type` applicable to that tool, either **resolved artifact** (id + minimal metadata + payload pointer for rule sets) or **`state: "missing"`** / **`state: "unconfigured"`** with machine-readable **reason**.  
3. **No** inference from uploads table ordering.  
4. **Caching:** Server-side TTL cache allowed; **invalidate on publish/rollback** of relevant artifacts.

---

## APIs

- **Server-only** helper, e.g. `resolveToolBindings(tool_key)` — **not** exposed as a public “guess config” API for untrusted clients if that would leak admin-only drafts; prefer **internal import** from tool/API routes.  
- If an HTTP surface exists for debugging, protect with **`admin`** or **`internal`** only.

---

## Credit Copilot note

**Credit Copilot** must resolve the governed Credit Policy through **CONTENT-002** only:

| `tool_key` | `binding_type` |
|------------|------------------|
| **`credit_copilot`** | **`credit_policy_document`** |

Do **not** select the “latest uploaded PDF” or list storage out of band. Use **`resolveToolBinding("credit_copilot", "credit_policy_document")`** (or equivalent) so only the **published** bound document is authoritative. Seed the binding after **`credit_policy`** exists: **[`CREDIT-DATA-001`](./CREDIT-DATA-001.md)** or manual **`/admin/bindings`**. Implementation contract (route, API, analytics, output posture): **[`TICKET-009`](./TICKET-009.md)**. Structured rule snapshots via **`CONFIG-001`** remain separate from PDF bytes.

---

## Definition of done

- [x] V1 **`binding_type`** enum enforced (DB check or application + tests).  
- [x] Resolver uses **published-only** semantics; tests prove **draft** upload does **not** change resolution until **publish**.  
- [x] Tests prove **no** `ORDER BY created_at DESC LIMIT 1` (or equivalent) for resolution — resolver queries by `(tool_key, binding_type, status=published)` only.  
- [x] Missing binding returns **explicit** state — assertions in tests.  
- [x] Resolver unit/integration tests run **server-side**; **no** browser-side selection logic for authoritative config.  
- [x] Documented: **no** live tool redesign / **no** engine math rewrite in **CONTENT-002** scope unless a separate spec says so.  
