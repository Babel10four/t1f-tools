# CREDIT-DATA-001 — Bind published Credit Policy to Credit Copilot

**Status:** approved (implementation: script + docs)  
**Last updated:** 2026-04-16  
**Depends on:** [`DATA-001`](./DATA-001.md) (or manual publish of a **`credit_policy`** document), [`CONTENT-002`](./CONTENT-002.md) resolver  
**Pairs with:** [`TICKET-009`](./TICKET-009.md) — Credit Copilot v1 (route, API, resolver, analytics, output posture)

---

## When to run (after Architect, before end-to-end QA)

**After** Architect lands Credit Copilot ([`TICKET-009`](./TICKET-009.md)), **before** full end-to-end QA, you need a **published** binding:

| `tool_key` | `binding_type` |
|------------|------------------|
| **`credit_copilot`** | **`credit_policy_document`** |

**Options:**

1. **Manual:** Create and publish it in **`/admin/bindings`**.  
2. **Script:** This ticket’s **`npm run data:credit-001`** — finds a published **`credit_policy`** document and creates/publishes the binding (see [Options](#options) below).

**Purpose:** **Initial binding setup only** — it wires CONTENT-002 so the resolver can point at the governed document. It is **not** retrieval logic, RAG, or Q&A behavior (that lives in **TICKET-009**).

---

## Goal

Establish the **CONTENT-002** prerequisite so **Credit Copilot** resolves the **governed** Credit Policy through the binding system — **not** by selecting the “latest uploaded PDF” or bypassing publish semantics.

---

## Frozen binding (Credit Copilot)

| `tool_key` | `binding_type` | Resolves to |
|------------|------------------|-------------|
| **`credit_copilot`** | **`credit_policy_document`** | The **published** `documents` row with **`doc_type = credit_policy`** that this binding targets |

**Runtime rule:** Credit Copilot should use **`resolveToolBinding("credit_copilot", "credit_policy_document")`** (or equivalent batch resolver) and use the resolved document id for retrieval / RAG / display metadata — **after** publish. It must **not** infer policy from “most recent upload” or storage listing.

---

## Why DATA-001 did not create this binding

[`DATA-001`](./DATA-001.md) correctly seeds the **Credit Policy PDF** as a governed document (`credit_policy`) and **`deal_engine`** rule bindings only. It **intentionally** does **not** wire **`credit_copilot`**, so Copilot stays disconnected until this follow-on.

---

## Options

1. **Manual:** In **`/admin/bindings`**, create and publish **`credit_copilot`** + **`credit_policy_document`** targeting the same published **`credit_policy`** document you want in production.  
2. **Script:** From the package root:

```bash
cd /Users/bable/T1F.tools

# Requires DATABASE_URL; expects at least one published credit_policy document
npm run data:credit-001
```

- **`--dry-run`** — If **`DATABASE_URL`** is set, prints which published **`credit_policy`** id would be bound and skips writes. If **`DATABASE_URL`** is unset, prints intent only (no resolution).

**Idempotency:** If a **published** binding already exists for **`credit_copilot`** + **`credit_policy_document`**, the script skips creation.

### Which published document is chosen?

The script ([`scripts/credit-data-001-bind-credit-policy.ts`](../../scripts/credit-data-001-bind-credit-policy.ts)) picks:

1. A **published** row with **`doc_type = credit_policy`** whose **`notes`** include **`DATA-001 seed credit_policy`** (initial DATA-001 load), if present; otherwise  
2. The **published** **`credit_policy`** row with the latest **`published_at`**.

Admins who manage multiple series should prefer **manual** binding or adjust notes/selection logic if a different policy row must win.

---

## Verification

- **`/admin/bindings`:** **`credit_copilot`** + **`credit_policy_document`** — **published**, document id matches the intended governed Credit Policy.  
- Resolver: **`resolveToolBinding("credit_copilot", "credit_policy_document")`** returns **`resolved`** with that document’s metadata (not **`missing`**) when the binding exists.

---

## Architecture reminder

| Layer | Role |
|-------|------|
| **Credit Policy PDF** (`credit_policy` document) | Governed **source / reference** |
| **CONTENT-002 binding** | **Authority** for which published document the tool uses |
| **Credit Copilot** (future) | Consumes resolved document id + text — **not** ad-hoc “latest PDF” |

---

## Definition of done

- [x] Spec documents **`credit_copilot`** + **`credit_policy_document`** and forbids latest-upload behavior.  
- [x] Script **`npm run data:credit-001`** creates the binding when a published **`credit_policy`** exists.  
- [ ] **Operational:** After Architect / **before E2E QA**, run script or manual binding in each target environment (or confirm binding already exists).
