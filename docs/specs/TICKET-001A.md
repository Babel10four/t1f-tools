# BUILD SPEC ADDENDUM — TICKET-001A (contract hardening)

**Status:** closed (completed 2026-04-16)  
**Last updated:** 2026-04-16  
**Parent:** [`TICKET-001`](./TICKET-001.md) — amends validation, normalization, response naming, and error envelope only.

**Scope:** Minimal contract hardening. No new tools, no pricing engine, no persistence, no auth.

---

## Changed rules

### 1. `schemaVersion` (strict)

- Value **must** be exactly **`deal_analyze.v1`** (string).
- **Required** on every request.
- **Missing**, **null**, **wrong type**, or **wrong value** → **400** with code **`UNSUPPORTED_SCHEMA_VERSION`**.
- **No defaulting** in normalization or elsewhere.

### 2. Loan LTV field name

- Public response field is **`loan.ltv`** (numeric ratio or agreed unit as documented in code).
- Do **not** use **`loan.ltvPercent`**.

### 3. Canonical numerics vs legacy coercion

- **Canonical path:** all numeric fields MUST be JSON **numbers** (finite). Non-number types (including numeric strings) on the canonical path → **400** (appropriate validation code; do not coerce).
- **Legacy discriminator:** top-level **`loan`** is present and is a plain **object** (legacy input path). **Numeric-string coercion** is permitted **only** while mapping fields **from that `loan` subtree** inside the legacy adapter. **No coercion** for values read from **`deal` / `property` / `borrower`** on the canonical path. After adapter output, validators still see numbers or reject.

### 4. Ambiguous combined shapes

- If the same request includes **both**:
  - a **`deal`** object that is treated as **canonical input** (non-null object), **and**
  - a top-level **`loan`** object (legacy input),
- then return **400** **`AMBIGUOUS_INPUT_SHAPE`** (do not guess precedence).

### 5. Ignored request fields: `pricing` / `cashToClose`

- Request **`pricing`** and **`cashToClose`** remain **ignored** for computation in v1.
- When either key is **present** on the request (any value), the response MUST include a **non-blocking** entry in **`analysis.flags`** (e.g. code `IGNORED_REQUEST_OUTPUT_FIELDS`) so clients see intentional behavior—not silent drops.

### 6. `400` response envelope (frozen)

Every **400** response body MUST be exactly this shape:

```json
{
  "error": "string",
  "code": "string",
  "issues": []
}
```

- **`issues`**: **`ValidationIssue[]`**, always present (use empty array `[]` when there are no structured issues beyond top-level `error`/`code`).

---

## Files to modify

- `src/lib/engines/deal/schemas/` — tighten `schemaVersion` and numeric validation; define `ValidationIssue` if absent.
- `src/lib/engines/deal/legacy/normalizeDealAnalyzeRequest.ts` — gate string coercion on legacy discriminator; never default `schemaVersion`.
- `src/lib/engines/deal/analyze.ts` — rename `ltvPercent` → **`ltv`** if applicable; emit **`analysis.flags`** for ignored `pricing`/`cashToClose`.
- `src/lib/engines/http.ts` (or deal-specific handler) — always emit **`issues`** array on **400**; map **`AMBIGUOUS_INPUT_SHAPE`**.

---

## Test cases

1. **Missing `schemaVersion`** → **400**, `code: UNSUPPORTED_SCHEMA_VERSION`, `issues` array present (may be empty).  
2. **`schemaVersion: null`** → same.  
3. **Wrong type** (e.g. number) for `schemaVersion` → **`UNSUPPORTED_SCHEMA_VERSION`**.  
4. **Wrong string** (e.g. `"1"`) → **`UNSUPPORTED_SCHEMA_VERSION`**.  
5. **Canonical `purchasePrice` as string** `"500000"` → **400** (no coercion on canonical path); not `UNSUPPORTED_SCHEMA_VERSION` unless that is the only failure—prefer field validation code.  
6. **Legacy payload** with discriminator + numeric strings in legacy fields → adapter may coerce; **200** when valid after adapter.  
7. **Both `deal` (object) and `loan` (object)** at root → **400** `AMBIGUOUS_INPUT_SHAPE`, `issues` present.  
8. **Request includes `pricing` or `cashToClose`** → **200** (if otherwise valid) with **non-blocking** `analysis.flags` entry for ignored output fields.  
9. **Any 400** (e.g. `INVALID_JSON`) → body has **`error`**, **`code`**, **`issues`** (possibly `[]`).  
10. **200 response** uses **`loan.ltv`** if LTV is emitted; assert no **`loan.ltvPercent`**.

---

## Definition of done

- All rules in **Changed rules** are implemented and covered by tests.  
- **`TICKET-001.md`** references this addendum (no conflicting prose left for amended topics).  
- No new tools, pricing engine, persistence, or auth; scope remains **analyze** endpoint + existing minimal verification UI only.

---

## Closure

**Closed:** 2026-04-16. Contract hardening for **`deal_analyze.v1`** (strict `schemaVersion`, canonical numerics vs legacy coercion, **`AMBIGUOUS_INPUT_SHAPE`**, **`loan.ltv`** naming, mandatory **`issues`** on **400**, **`analysis.flags`** for ignored request `pricing` / `cashToClose`) is implemented and covered by tests.

**Follow-up (not bundled here):** [`TECH-001`](./TECH-001.md), [`DOC-001`](./DOC-001.md).
