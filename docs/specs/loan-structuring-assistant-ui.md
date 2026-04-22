# Loan Structuring Assistant — frozen UI contract (Architect)

**Superseded for ticket execution by:** [`TICKET-003`](./TICKET-003.md) — use that BUILD SPEC for Builder handoff; this file remains as a concise architectural freeze reference.

**Status:** approved (freeze)  
**Last updated:** 2026-04-17  
**API consumer:** [`POST /api/deal/analyze`](../../src/lib/engines/http.ts) — **`schemaVersion: deal_analyze.v1`** only.  
**Policy / engine:** [`TICKET-002`](./TICKET-002.md), [`docs/business-rules/deal-engine-v1-assumptions.md`](../business-rules/deal-engine-v1-assumptions.md)

This document replaces vague copy with **exact field lists**, **exact panel order**, and **explicit non-goals**. No “etc.” — if a field is not listed here, the UI does not collect it.

---

## 1. Routes and product naming

| Surface | Route | Role |
|--------|-------|------|
| **Loan Structuring Assistant** | **`/tools/loan-structuring-assistant`** | Rep-facing structured UI (primary). |
| **Pricing Calculator** | **`/tools/pricing-calculator`** | Sibling rep tool — same request model as this spec. |
| **Cash to Close Estimator** | **`/tools/cash-to-close-estimator`** | Sibling rep tool — cash-centric display; see [`cash-to-close-estimator-ui.md`](./cash-to-close-estimator-ui.md). |
| **Term Sheet Generator** | **`/tools/term-sheet`** | Authoritative: [`TICKET-007.md`](./TICKET-007.md); reference: [`term-sheet-generator-ui.md`](./term-sheet-generator-ui.md). |
| **Deal Analyzer** | **`/tools/deal-analyzer`** | Internal JSON harness — edit raw request bodies; not the rep-facing surface. |

**Page title / product label (browser + H1):** **Loan Structuring Assistant**

---

## 2. Flow-to-payload mapping (frozen)

The flow selector is **UI-only**. It serializes into the **existing** request shape. **No new API enum** and **no new request keys**.

| UI flow | `deal.purpose` | `deal.productType` |
|---------|------------------|--------------------|
| Purchase | `purchase` | `bridge_purchase` |
| Refinance | `refinance` | `bridge_refinance` |

Architect does not re-decide this mapping later.

---

## 3. Exact input set (v1)

Only fields the **frozen contract** already accepts. Map UI labels to JSON paths as below.

**Forbidden:** occupancy, pricing inputs, cash-to-close inputs, top-level `loan`, margin fields, or any field not in TICKET-001/001A request tables. This UI **consumes** the API; it is not a policy surface.

### Purchase flow

| UI concept | JSON path | Rule |
|------------|-----------|------|
| Purchase price | `deal.purchasePrice` | **Required** |
| Rehab budget | `deal.rehabBudget` | Optional; default **`0`** if omitted |
| ARV | `property.arv` | **Recommended required** for this UI flow (soft-block or inline validate before submit) |
| Requested loan amount | `deal.requestedLoanAmount` | Optional |
| Term (months) | `deal.termMonths` | Optional; use **`null`** when unknown |
| FICO | `borrower.fico` | Optional |
| Experience tier | `borrower.experienceTier` | Optional |

Always send: `schemaVersion: "deal_analyze.v1"`, `deal.purpose`, `deal.productType` per §2, and required deal fields per engine validation.

### Refinance flow

| UI concept | JSON path | Rule |
|------------|-----------|------|
| Payoff amount | `deal.payoffAmount` | |
| Requested loan amount | `deal.requestedLoanAmount` | **At least one** of `payoffAmount` or `requestedLoanAmount` must be present |
| As-is value | `property.asIsValue` | **Primary** property value field for this flow |
| ARV | `property.arv` | Optional; secondary / fallback context |
| Term (months) | `deal.termMonths` | Optional; **`null`** when unknown |
| FICO | `borrower.fico` | Optional |
| Experience tier | `borrower.experienceTier` | Optional |

**Refinance ask rule (UI):** If **`payoffAmount`** is provided, **`requestedLoanAmount`** is optional. If **`payoffAmount`** is not provided, **`requestedLoanAmount`** is **required**.

---

## 4. Output layout (fixed hierarchy)

Render **server JSON** in this order. Do not invent panels for data the API does not return.

### Summary strip (top)

1. **`loan.amount`**
2. **`loan.ltv`**
3. **`pricing.status`**
4. **`cashToClose.estimatedTotal`** (label as **cash-to-close total** in copy; field name stays `estimatedTotal`)

### Results panels

**A. Cash to Close**

- `cashToClose.items` — line items in **server order**
- Total — same as summary strip total (`estimatedTotal`)

**B. Binding / Analysis Flags**

- **First:** binding-leg flags (e.g. `PURCHASE_POLICY_MAX_BINDS_LTC`, `PURCHASE_POLICY_MAX_BINDS_ARV` when present)
- **Second:** other informational flags (`severity` + `message` + `code`; do not rewrite copy)

**C. Risks / Next Actions**

- Group by **`severity`** (e.g. high → medium → low → info)
- **Server `title` / `detail` only** — no client paraphrase or “fixes”

**D. Secondary Details**

- `deal`-echoed **`termMonths`**, **`productType`** (from `loan` echo as applicable)
- **Delta:** stated ask vs **`loan.amount`** — show only when **ask** exists (`deal.requestedLoanAmount` input echoed or comparable) and **`loan.amount`** is present; **display-only** math: `ask - loan.amount` (or signed delta as specified in implementation), **no** client-side capping

### LTC rule (important)

- **Do not** reserve a primary metric tile for raw **LTC** unless the API exposes a **numeric `loan.ltc` or equivalent top-level field** (it does not today).
- Treat **LTC** as **signals in `analysis.flags` / `risks`**, not as a guaranteed primary number.

---

## 5. Client-side logic boundary

### Allowed

- Field visibility by flow (Purchase vs Refinance)
- Local **required-field hints** (before submit) aligned with §3
- Disable **Analyze** while submitting
- **Delta math** between ask and **`loan.amount`** (subtraction only; display)
- Layout grouping and ordering per §4

### Forbidden

- Client-side **capping** of loan amounts
- **LTV/LTC math** that competes with the server
- Client-side **pricing** logic
- Inferred “fixes” or rewriting server outcomes
- **Severity** or **message** rewrites on flags/risks

**Server output is authoritative.**

---

## 6. State machine (explicit)

| State | Meaning |
|-------|---------|
| `idle` | Initial / no in-flight request |
| `editing` | User has changed inputs since last result (optional sub-state; may fold into idle) |
| `submitting` | Request in flight; disable submit |
| `success` | **2xx** response with parsed body |
| `error_4xx` | **4xx** — must surface **`error`**, **`code`**, and **`issues`** (array) from JSON body when present |
| `error_5xx` | **5xx** or network failure — show message + safe retry |

**4xx requirement:** Never show only `"HTTP 400"`. Parse JSON and render **`error`**, **`code`**, and each **`issues`** entry (e.g. `path`, `message`).

---

## 7. Input matrix (single table)

| Section | Purchase | Refinance |
|---------|----------|-----------|
| **Flow** | Purchase | Refinance |
| **Hidden mapping** | `purpose=purchase`, `productType=bridge_purchase` | `purpose=refinance`, `productType=bridge_refinance` |
| **Primary value** | `deal.purchasePrice` | `deal.payoffAmount` **or** `deal.requestedLoanAmount` (at least one) |
| **Rehab** | `deal.rehabBudget` (optional, default 0) | — |
| **Property value** | `property.arv` (recommended required) | `property.asIsValue` primary; `property.arv` optional |
| **Ask** | `deal.requestedLoanAmount` optional | Optional if `payoffAmount` set; **required** if no `payoffAmount` |
| **Term** | `deal.termMonths` optional | `deal.termMonths` optional |
| **Borrower** | `borrower.fico`, `borrower.experienceTier` optional | Same |

---

## 8. Definition of done (UI implementation)

- [ ] Route **`/tools/loan-structuring-assistant`** ships with title **Loan Structuring Assistant**.  
- [ ] Flow control maps exactly to §2; payload uses only §3 fields.  
- [ ] Results follow §4 order; no raw LTC primary tile unless API adds numeric LTC.  
- [ ] No forbidden client logic per §5.  
- [ ] States per §6; **4xx** shows full error envelope.  
- [ ] **`/tools/deal-analyzer`** remains raw JSON harness (unchanged role).
