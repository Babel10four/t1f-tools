# BUILD SPEC — TICKET-001

**Status:** closed (completed 2026-04-16)  
**Last updated:** 2026-04-16  
**Related brief:** [`docs/briefs/TICKET-001.md`](../briefs/TICKET-001.md)  
**Contract hardening:** [`TICKET-001A`](./TICKET-001A.md) — strict `schemaVersion`, canonical numerics, ambiguous-shape error, `loan.ltv` naming, legacy-only coercion, mandatory **`issues`** on **400**, and **`analysis.flags`** for ignored request `pricing`/`cashToClose`.

---

## Ticket

**TICKET-001** — Canonical `POST /api/deal/analyze` request/response (v1 stub), validation, legacy normalization adapter, minimal UI verification.

---

## Objective

Ship a **frozen public JSON contract** for deal analysis with:

- Exact **`schemaVersion`** value: **`deal_analyze.v1`** (required; no defaulting — see **TICKET-001A**).
- **Field ownership** only on **`deal`**, **`property`**, and **`borrower`** as listed below (no public input `loan`, `pricing`, or `cashToClose`).
- **Numbers only** for numeric fields on the **canonical** path; **legacy-only** numeric-string coercion is defined in **TICKET-001A**.
- **Hybrid HTTP:** **400** for malformed or insufficient-to-analyze; **200** for analyzable payloads with **`analysis.status`** and **`analysis.flags`** (no `reasonCodes`).
- **Stub** `pricing` and `cashToClose`, each with an explicit **`status`** so outputs are not mistaken for final pricing/closing figures.
- **`loan`** output limited to **normalized canonical inputs** plus **metrics actually computed** in v1—no speculative fields.

**Explicitly out of scope:** real pricing engine, PDFs, persistence, auth, UI beyond endpoint verification.

---

## Request contract

**Route:** `POST /api/deal/analyze`  
**Content-Type:** `application/json`

### Root

| Field | Type | Required |
|--------|------|----------|
| `schemaVersion` | string | Yes — must equal **`deal_analyze.v1`** exactly. |
| `deal` | object | Yes |
| `property` | object | No |
| `borrower` | object | No |
| `assumptions` | object | No |

### `deal` (field ownership frozen)

| Field | Type | Notes |
|--------|------|--------|
| `purpose` | string (enum) | Required. At minimum `purchase` \| `refinance` (document enum in code). |
| `productType` | string | Required; non-empty after trim. |
| `purchasePrice` | number | Required when `purpose === "purchase"`. |
| `payoffAmount` | number | Refinance: required unless `requestedLoanAmount` satisfies refinance amount rule. |
| `requestedLoanAmount` | number | Refinance: at least one of `payoffAmount` or `requestedLoanAmount` required. |
| `rehabBudget` | number | Optional; **defaults to `0`** when omitted. |
| `termMonths` | number \| null | Optional; omit or null if unknown. |

### `property` (field ownership frozen)

| Field | Type | Notes |
|--------|------|--------|
| `arv` | number | At least one of `arv` or `asIsValue` required for analyzable payload (see validation). |
| `asIsValue` | number | Same. |

### `borrower` (field ownership frozen)

| Field | Type | Notes |
|--------|------|--------|
| `fico` | number | Optional in v1. |
| `experienceTier` | string | Optional in v1. |

### Public numeric rule

- All numeric fields on the **canonical** request MUST be JSON **numbers** (finite).
- **TICKET-001A:** string coercion is allowed **only** in the legacy adapter **when a legacy discriminator is present**; canonical requests with numeric strings **fail validation** (do not coerce).

### Forbidden on public contract

- No **`loan`**, **`pricing`**, or **`cashToClose`** as authoritative inputs. Legacy payloads may be adapted internally only.

---

## Response contract

### HTTP

| Status | When |
|--------|------|
| **200** | JSON parsed; `schemaVersion` supported; payload sufficient to **analyze** (may be **incomplete** per `analysis.status`). |
| **400** | Invalid JSON, unsupported schema, or insufficient-to-analyze per rules below. |
| **500** | Unexpected server failure. |

### Body (200)

| Field | Type | Description |
|--------|------|-------------|
| `schemaVersion` | string | Echo **`deal_analyze.v1`** (or response schema version if split later). |
| `analysis` | object | See below. |
| `loan` | object | Output only; see **Loan output (v1)**. |
| `pricing` | object | Computed stub only; **must include `status`**. |
| `cashToClose` | object | Computed stub only; **must include `status`**. |
| `risks` | array | **Structured objects only** (never `string[]`). |

### `analysis`

```ts
analysis: {
  status: "complete" | "incomplete";
  flags: AnalysisFlag[];
}
```

**`AnalysisFlag`:** structured object (e.g. `code`, `severity`, `message`, optional `context: Record<string, unknown>`). No parallel `reasonCodes` array on `analysis`.

### `pricing` and `cashToClose` (stub)

Each object **must** include:

- **`status`**: e.g. `"stub"` \| `"unavailable"` \| `"complete"` — v1 stub SHOULD use **`stub`** (or equivalent documented value) so clients never treat outputs as final.

Remaining fields are stub-specific (e.g. nullable rate fields, line items) and MUST NOT be sourced from request in the canonical path.

### Loan output (v1)

Include **only**:

1. **Normalized echoes** from canonical inputs where they map 1:1 to loan semantics, e.g. `purpose`, `productType`, `termMonths`, `rehabBudget` (after default), amounts implied by deal/property rules **without inventing** unsupported fields.
2. **Metrics actually computed** in v1 (e.g. if LTV is computed from agreed inputs in this ticket, expose it as **`loan.ltv`** — not `loan.ltvPercent`; if not computed, **omit**—do not emit null placeholders for speculative metrics).

Do **not** add fields “for future use” or speculative underwriting fields.

### `risks`

Array of structured objects (e.g. `code`, `severity`, `title`, structured `detail`). Not plain strings at the array element level.

---

## Validation rules

### After normalization (numbers only for numerics)

**400 — insufficient or invalid**

- Unsupported, missing, null, wrong type, or wrong string for `schemaVersion` (must be exactly **`deal_analyze.v1`**) → **`UNSUPPORTED_SCHEMA_VERSION`** (**TICKET-001A:** no defaulting).
- Missing or non-object `deal`.
- Missing `deal.purpose` → **`MISSING_PURPOSE`**
- Missing or empty `deal.productType` → **`MISSING_PRODUCT_TYPE`**
- `purpose === "purchase"` and missing/invalid `purchasePrice` → **`MISSING_PURCHASE_PRICE`**
- `purpose === "refinance"` and neither valid `payoffAmount` nor valid `requestedLoanAmount` → **`MISSING_REFI_AMOUNT`**
- Neither `property.arv` nor `property.asIsValue` present and valid → **`MISSING_COLLATERAL_VALUE`**
- `deal` missing entirely → **`MISSING_DEAL`**

**400 — malformed**

- Invalid JSON → **`INVALID_JSON`**
- Wrong root shape (not object) → use **`INVALID_JSON`** or **`MISSING_DEAL`** per implementation choice; document in code.

**200 — analyzable**

- Minimum set satisfied; optional gaps (e.g. missing `borrower`, partial property context) → `analysis.status: "incomplete"` and populated **`analysis.flags`**.

### `rehabBudget`

- Omitted → treat as **`0`**.
- Invalid type (not number after normalization) → **400** with explicit code (extend list if needed, e.g. `INVALID_NUMERIC_FIELD`, or fold into validation of `deal`).

---

## Normalization rules

1. **Public contract** is canonical JSON as above.
2. **Legacy adapter** (single module):  
   - Map historical shapes (e.g. top-level `loan`, nested `loan`, old field names) into **`deal` / `property` / `borrower`**.  
   - **TICKET-001A:** coerce numeric strings **only** when the legacy discriminator applies; never default `schemaVersion`.  
   - Do not run legacy mapping when canonical **`deal`** and legacy **`loan`** are both present as competing inputs → **400** `AMBIGUOUS_INPUT_SHAPE`.  
   - Ignore request **`pricing`** / **`cashToClose`** for computation; **TICKET-001A:** when present, add a **non-blocking** **`analysis.flags`** entry (not optional silence).
3. **Engine and validators** consume **only** normalized canonical types (numbers for numerics).

---

## Business logic (v1 stub)

- Build **`loan`** from normalized **`deal`** (+ optional **`property`**, **`borrower`**) under **Loan output** rules.
- Compute **`pricing`** and **`cashToClose`** in-process with **`status: "stub"`** (or documented equivalent); no external pricing APIs.
- Emit **`risks`** and **`analysis.flags`** from stub rules; no persistence.

---

## File plan

**Artifacts (this ticket)**

- [`docs/briefs/TICKET-001.md`](../briefs/TICKET-001.md) — approved Scout brief  
- `docs/specs/TICKET-001.md` — this BUILD SPEC  

**Create (implementation)**

- `src/lib/engines/deal/schemas/` — types + validators for canonical request/response  
- `src/lib/engines/deal/legacy/normalizeDealAnalyzeRequest.ts` — string coercion + shape mapping  

**Modify**

- `src/lib/engines/deal/analyze.ts` — canonical pipeline, stub outputs with **`status`**, **`analysis`**.  
- `src/lib/engines/http.ts` or dedicated handler — map validation to **400** with **`code`** from table below.  
- `src/app/tools/deal-analyzer/page.tsx` — minimal verification only.  

**Do not add:** pricing engine, PDF, DB, auth middleware.

---

## 400-level error codes (explicit)

| Code | Typical condition |
|------|-------------------|
| `INVALID_JSON` | Body not valid JSON or not a JSON object where required. |
| `UNSUPPORTED_SCHEMA_VERSION` | Missing or not exactly `deal_analyze.v1`. |
| `MISSING_DEAL` | `deal` missing or not a plain object. |
| `MISSING_PURPOSE` | `deal.purpose` missing or invalid. |
| `MISSING_PRODUCT_TYPE` | `deal.productType` missing or empty. |
| `MISSING_PURCHASE_PRICE` | Purchase path without valid `purchasePrice`. |
| `MISSING_REFI_AMOUNT` | Refinance without valid `payoffAmount` or `requestedLoanAmount`. |
| `MISSING_COLLATERAL_VALUE` | Neither valid `property.arv` nor `property.asIsValue`. |
| `AMBIGUOUS_INPUT_SHAPE` | Canonical **`deal`** and legacy **`loan`** both supplied (**TICKET-001A**). |

**400 envelope (TICKET-001A):** always `{ "error": string, "code": string, "issues": ValidationIssue[] }` — `issues` required (may be `[]`).

---

## Test cases

1. Valid minimal purchase + `property.asIsValue` → **200**, `analysis.status` `complete` or `incomplete` per rules, `pricing.status` and `cashToClose.status` present.  
2. Valid minimal refinance with `payoffAmount` + `arv` → **200**.  
3. Wrong `schemaVersion` → **400** `UNSUPPORTED_SCHEMA_VERSION`.  
4. Missing `deal` → **400** `MISSING_DEAL`.  
5. Missing purpose / product type → **400** `MISSING_PURPOSE` / `MISSING_PRODUCT_TYPE`.  
6. Purchase without `purchasePrice` → **400** `MISSING_PURCHASE_PRICE`.  
7. Refinance without payoff or requested amount → **400** `MISSING_REFI_AMOUNT`.  
8. No `arv` or `asIsValue` → **400** `MISSING_COLLATERAL_VALUE`.  
9. Omitted `rehabBudget` → treated as **0**; **200** when other rules pass.  
10. **TICKET-001A:** Legacy numeric strings → coerce **only** with legacy discriminator → **200** when valid after adapter.  
11. **TICKET-001A:** Canonical numeric string on `purchasePrice` → **400** (no coercion).  
12. Invalid JSON → **400** `INVALID_JSON`, `issues` present.  
13. Response has no `analysis.reasonCodes`; flags live under **`analysis.flags`**.  
14. See **TICKET-001A** test list for `schemaVersion` strictness, `AMBIGUOUS_INPUT_SHAPE`, ignored `pricing`/`cashToClose` flags, **`loan.ltv`** naming, and mandatory **`issues`** on all **400**s.

---

## Rollback plan

- Revert PR restoring prior `analyze` + HTTP behavior.  
- Document contract version **`deal_analyze.v1`** as withdrawn only if rollback is total; partial rollback should not leave dual contracts without a decision record in `docs/decisions/`.

---

## Definition of done

- [`docs/briefs/TICKET-001.md`](../briefs/TICKET-001.md) and this spec committed and match implementation behavior.  
- **`schemaVersion`** accepted value is **exactly** `deal_analyze.v1`.  
- Field ownership matches **deal / property / borrower** tables.  
- Public contract uses **numbers** for numerics; adapter-only string coercion.  
- **`analysis`** uses **`status` + `flags` only** (no `reasonCodes`).  
- **`pricing`** and **`cashToClose`** each include **`status`**.  
- **`loan`** has no speculative fields.  
- All **400** codes in the table above (including **TICKET-001A** `AMBIGUOUS_INPUT_SHAPE`) are implemented; **400** bodies match **TICKET-001A** envelope with mandatory **`issues`**.  
- **TICKET-001A** rules implemented or explicitly deferred only with a new ticket reference.  
- No pricing engine, PDFs, persistence, or auth; minimal UI verifies the endpoint.

---

## Closure

**Closed:** 2026-04-16. The canonical **`POST /api/deal/analyze`** contract is frozen at **`deal_analyze.v1`**, with strict **`schemaVersion`** (no defaulting), a single backend surface intended to power Structuring Assistant, Pricing Calculator, and Cash to Close without divergent DTOs or logic paths. Golden fixtures live under [`tests/fixtures/`](../../tests/fixtures/).

**Follow-up (not bundled here):** [`TECH-001`](./TECH-001.md), [`DOC-001`](./DOC-001.md).
