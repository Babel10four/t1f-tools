# DATA-001 — Initial published policy data load

**Status:** closed (initial data-load mechanism; audit-verified)  
**Last updated:** 2026-04-18  

---

## Goal

Load the first production policy artifacts into the admin system: published **documents** (PDFs), published **rule_sets** (`rates`, `calculator_assumptions`), and published **tool_bindings** for the shared deal engine — **without** prematurely wiring Credit Copilot or Rural Checker.

---

## Scope

### Documents (upload + publish)

| Document | `doc_type` | Notes |
|----------|------------|--------|
| Tier One Funding Credit Policy (e.g. ver. 10.30.2025) | `credit_policy` | Governed source for **future** Credit Copilot (not wired in this seed). |
| Rural Property Identification | `rural_policy` | Governed source for **future** Rural Checker (not wired in this seed). |
| Optional pricing reference PDF | *(any)* | Reference only — **not** runtime truth for rates (`rates` **rule_set** + CONTENT-002 is). |

### Rule sets (create draft → publish)

| `rule_type` | Purpose |
|-------------|---------|
| `rates` | Indicative rate table + optional pricing numerics (see validator + POLICY-ADOPTION-001). |
| `calculator_assumptions` | Engine defaults: LTC / ARV LTV / refi LTV caps, default term, LTV threshold, cash-to-close multipliers. |

Initial calculator payload matches embedded engine defaults in `policy/constants.ts` until capital replaces them.

### Bindings (this seed only)

| `tool_key` | `binding_type` |
|------------|----------------|
| `deal_engine` | `rates_rule_set` |
| `deal_engine` | `calculator_assumptions_rule_set` |

**Explicitly not in this seed:** `credit_copilot` / `rural_checker` bindings, `rural_rules_rule_set`, or `credit_policy_document` / `rural_policy_document` **bindings** — PDFs are **uploaded and published** as governed documents; tools that consume them come later.

**Follow-on:** When **Credit Copilot** is implemented, add the **`credit_copilot` + `credit_policy_document`** binding via **`/admin/bindings`** or **[`CREDIT-DATA-001`](./CREDIT-DATA-001.md)** (`npm run data:credit-001`) — not part of DATA-001.

---

## Where assets belong (architecture rule)

**PDFs** = governed **source / reference** material. **Rule sets** = **executable runtime truth** for calculators and deal engine math. The deal engine **does not parse PDFs at runtime**.

### Upload / load now

Use **DATA-001** (`npm run data:001`) **or** the admin UI.

| Asset | Destination | Runtime role **right now** |
|-------|----------------|------------------------------|
| Credit Policy PDF | `/admin/documents` as **`credit_policy`** | Governed source for **future** Credit Copilot |
| Rural Definition PDF | `/admin/documents` as **`rural_policy`** | Governed source for **future** Rural Checker |
| Rates | `/admin/rules` as **`rates`** | **Live** — deal tools / engine use via bindings |
| Calculator assumptions | `/admin/rules` as **`calculator_assumptions`** | **Live** — deal engine policy math |

---

## Automation script (local or CI with DB + storage)

From the `t1f-tools` package root:

```bash
cd /Users/bable/T1F.tools

# Optional: override PDF paths
export CREDIT_POLICY_PDF="$HOME/Downloads/YourCreditPolicy.pdf"
export RURAL_POLICY_PDF="$HOME/Downloads/YourRuralPolicy.pdf"

# Requires DATABASE_URL; storage via BLOB_READ_WRITE_TOKEN or local .local-documents/
npm run data:001
```

- **`--dry-run`** — validates PDF paths and magic bytes; no DB (does not require `DATABASE_URL`).
- **Idempotency:** Skips re-uploading a document if a **published** row already exists with the same seed note (`DATA-001 seed …`). Skips creating rule_sets if a **published** row already exists for that `rule_type`. Skips bindings if a **published** row already exists for `deal_engine` + that `binding_type`.

## Production (t1f.tools)

If you run the script **locally**, data lands in **your** Postgres + blob/local storage — not production.

For real launch:

1. Production `DATABASE_URL` and object storage (`BLOB_READ_WRITE_TOKEN` or equivalent) are live.
2. Admin login works.
3. Either:
   - Run `npm run data:001` from a secure environment with **production** env vars, **or**
   - Manually upload/publish via **`/admin/documents`**, **`/admin/rules`**, **`/admin/bindings`**.

---

## Verification

After `npm run data:001` (or equivalent admin actions):

| Surface | Expected |
|---------|----------|
| **`/admin/documents`** | **`credit_policy`** — published; **`rural_policy`** — published |
| **`/admin/rules`** | **`rates`** — published; **`calculator_assumptions`** — published |
| **`/admin/bindings`** | **`deal_engine`** + **`rates_rule_set`**; **`deal_engine`** + **`calculator_assumptions_rule_set`** (published) |

Optional API check (as admin): `GET /api/admin/tool-bindings/resolve?tool_key=deal_engine&binding_type=rates_rule_set` resolves to the rates rule set.

---

## Audit closure (verified)

Latest audit confirms **DATA-001** passed: uploads/publishes Credit Policy and Rural PDFs as governed documents; creates/publishes **`rates`** and **`calculator_assumptions`**; binds **only** **`deal_engine`** rule sets — **without** prematurely wiring Credit Copilot or Rural Checker.

---

## Definition of done

- [x] Script + docs for initial load.  
- [x] Published documents and rule sets + **deal_engine** bindings only, per scope.  
- [x] Architecture: PDFs reference; rule sets executable; engine does not parse PDFs at runtime.  

---

## Closure

**Closed:** 2026-04-18 — **initial data-load mechanism** complete and **audit-verified**. Future loads or production promotion follow ops runbooks; extending bindings to Credit Copilot / Rural Checker is **out of scope** for DATA-001.
