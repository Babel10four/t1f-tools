# BUILD SPEC — TICKET-005

**Status:** approved  
**Last updated:** 2026-04-17  
**Scout brief:** [`docs/briefs/TICKET-005.md`](../briefs/TICKET-005.md)  
**API contract (frozen):** [`TICKET-001`](./TICKET-001.md), [`TICKET-001A`](./TICKET-001A.md) — **no changes**  
**Engine (frozen):** [`TICKET-002`](./TICKET-002.md), [`TICKET-002A`](./TICKET-002A.md) — **no engine changes**  
**Reference UI patterns:** [`TICKET-003`](./TICKET-003.md) (Loan Structuring Assistant — **do not modify** that route except shared nav if needed)

---

## Objective

Deliver a **cash-to-close-first** rep-facing page at **`/tools/cash-to-close-estimator`** that calls **`POST /api/deal/analyze`** with **`schemaVersion: deal_analyze.v1`** and renders results **without** changing request/response contracts or adding **policy logic in the browser**.

**Must remain intact (no behavioral or routing regressions for this ticket’s scope):**

- `/tools/deal-analyzer` — internal JSON harness  
- `/tools/loan-structuring-assistant` — loan-focused UI  
- `/tools/pricing-calculator` — existing pricing surface  

**One page**, **Purchase + Refinance**, **one primary action** (“Estimate Cash” or equivalent label), minimal polish.

---

## Route / file plan

| Artifact | Path |
|----------|------|
| Rep-facing page | `src/app/tools/cash-to-close-estimator/page.tsx` — default export; use **`"use client"`** if the form and state live here, or split into `cash-to-close-estimator-client.tsx` if preferred |
| Optional components | `src/app/tools/cash-to-close-estimator/components/*` — only if split keeps files readable |
| Types | Import **`DealAnalyzeRequestV1`**, **`DealAnalyzeResponseV1`** from `@/lib/engines/deal/schemas/*` for typing only |

**Do not modify:** `src/app/api/deal/analyze/*`, `src/lib/engines/deal/*` (engine), **`/tools/loan-structuring-assistant/**`, **`/tools/pricing-calculator/**`** (unless a shared import path fix is required — avoid).

**Navigation:** `src/app/tools/layout.tsx` already includes **Cash to Close Estimator** — ensure the page exists so the link does not 404.

---

## Exact input model

**Flow selector** maps to:

| UI flow | `deal.purpose` | `deal.productType` |
|---------|----------------|---------------------|
| Purchase | `purchase` | `bridge_purchase` |
| Refinance | `refinance` | `bridge_refinance` |

### Purchase — collect only

| JSON path | Notes |
|-----------|--------|
| `deal.purchasePrice` | Required for UX (block submit with hint or rely on API **400**) |
| `deal.rehabBudget` | Optional; default **`0`** in serialized body |
| `property.arv` | **Recommended** primary value field (hint copy) |
| `deal.requestedLoanAmount` | Optional |
| `deal.termMonths` | Optional — `null` when empty |
| `borrower.fico` | Optional |
| `borrower.experienceTier` | Optional |

### Refinance — collect only

| JSON path | Notes |
|-----------|--------|
| `deal.payoffAmount` | At least one of payoff **or** requested |
| `deal.requestedLoanAmount` | At least one of the two |
| `property.asIsValue` | **Recommended** primary |
| `property.arv` | Optional secondary |
| `deal.termMonths` | Optional |
| `borrower.fico` | Optional |
| `borrower.experienceTier` | Optional |

**Never collect:** pricing inputs, `cashToClose` inputs, `loan`, margins, occupancy, or any field not in [`DealAnalyzeRequestV1`](../../src/lib/engines/deal/schemas/canonical-request.ts).

---

## Request serialization rules

1. **`schemaVersion`:** always **`"deal_analyze.v1"`** (exact).  
2. **`deal.purpose` / `deal.productType`:** from flow table.  
3. **JSON numbers only** for numeric fields (no numeric strings on the wire).  
4. **`deal.rehabBudget`:** **`0`** when omitted (Purchase).  
5. **`deal.termMonths`:** **`null`** when empty (or omit if validator accepts — **prefer `null`** for consistency with TICKET-003).  
6. Omit empty **`property`** / **`borrower`** objects.  
7. **Do not** send `assumptions` unless a future ticket requires it.

---

## Exact `cashToClose` field inventory (current response type)

Source: [`DealAnalyzeCashToCloseOutV1`](../../src/lib/engines/deal/schemas/canonical-response.ts) and [`DealAnalyzeCashToCloseStatus`](../../src/lib/engines/deal/schemas/deal-engine-v1-enums.ts).

| Field | Type | UI rule |
|-------|------|--------|
| `cashToClose.status` | `DealAnalyzeCashToCloseStatus` (same union as `pricing.status`: `stub` \| `complete` \| `indicative` \| `insufficient_inputs` \| `needs_review`) | Show in **cash summary strip**; **no** client-side inference of meaning beyond display |
| `cashToClose.estimatedTotal` | `number \| null` | **Primary** displayed number in cash summary; if **`null`**, show **—** / “Not available” — **do not** sum `items` in the browser |
| `cashToClose.items` | `Array<{ label: string; amount: number }>` | Render **only** server-provided rows; **if `items.length === 0`**, show empty state — **do not invent lines** |
| *(implicit)* | Order | **Preserve API order** — render `items` in **array order** as returned |

**Forbidden in UI:** computing a total from `items` when **`estimatedTotal` is `null`**; re-labeling lines; reordering lines; summing for “missing” total.

---

## Component tree (suggested)

```text
CashToCloseEstimatorPage
├── Header (H1 + link to deal-analyzer harness; optional link to loan-structuring-assistant)
├── FlowSelector (Purchase | Refinance)
├── CashToCloseForm
│   ├── flow-specific fields
│   └── Primary button: "Estimate Cash"
├── ApiStateRegion
│   ├── idle | editing | submitting | success | error_4xx | error_5xx
└── SuccessResults (success only)
    ├── CashSummaryStrip (status + estimatedTotal)
    ├── CashLineItems (items in server order; labels verbatim)
    ├── AnalysisContextPanel (analysis.status + analysis.flags)
    ├── RisksPanel (risks grouped by severity; title + detail verbatim)
    └── SecondaryContextPanel (loan.amount, loan.ltv, pricing.status, termMonths, productType)
```

---

## API state machine

| State | Behavior |
|-------|----------|
| `idle` | Form ready; no results |
| `editing` | User changed input after load or after a run |
| `submitting` | Primary action disabled; loading copy |
| `success` | HTTP **200**; parse JSON as **`DealAnalyzeResponseV1`** |
| `error_4xx` | Render **`error`**, **`code`**, **`issues`** (if array present) from body |
| `error_5xx` | Generic message (e.g. “Something went wrong”); **no** fake **`issues`** array |

---

## Output mapping (recommended v1 order)

1. **Cash summary strip** — `cashToClose.status`, `cashToClose.estimatedTotal` (formatted as currency **display-only**).  
2. **Cash-to-close line items** — iterate `cashToClose.items` in **order**; **`label`** and **`amount`** exactly as returned (format numbers only).  
3. **Analysis context** — `analysis.status`; `analysis.flags` (completeness / assumptions — **server `message` only**).  
4. **Risks / next actions** — `risks[]`: group by **`severity`** (e.g. high → medium → low → info); **`title`** + **`detail`** verbatim.  
5. **Secondary context** — `loan.amount`, `loan.ltv`, `pricing.status`, `loan.termMonths`, `loan.productType` — **contextual**, not the hero row.

**Disclaimers (copy):** Page must include **non-regulatory** framing: **not** a final settlement statement, **not** HUD/CD-style — short static line near the cash summary is acceptable (static **client** disclaimer only; **no** fabricated numbers).

---

## Loading / error / empty behavior

- **Loading:** Disable primary button + show loading text.  
- **`estimatedTotal === null`:** Do not compute a substitute total from items.  
- **`items.length === 0`:** Show “No line items” or equivalent — **no** placeholder lines.  
- **4xx:** Full envelope per TICKET-001A shape.  
- **5xx / network:** Generic error; **no** `issues` unless server returned them (unlikely for 5xx).

---

## Manual QA scenarios

1. Purchase with valid inputs → **200**; total and lines match server JSON; order preserved.  
2. Response with **`estimatedTotal: null`** → UI shows null/—; **no** client sum of items.  
3. Response with **`items: []`** → empty lines section; **no** invented rows.  
4. Refinance with payoff + as-is → **200**; cash section first.  
5. **400** validation → **`error`**, **`code`**, **`issues`** visible.  
6. Simulated **500** → generic error; no fake issues.  
7. **`/tools/deal-analyzer`**, **`/tools/loan-structuring-assistant`**, **`/tools/pricing-calculator`** still load and behave as before.  
8. Flow switch clears or resets results (implementation choice — document in code comment).  

---

## Definition of done

- [ ] **`/tools/cash-to-close-estimator`** implements form + state machine + output layout per this spec.  
- [ ] Request uses **only** frozen fields; flow mapping matches **bridge_purchase** / **bridge_refinance**.  
- [ ] **No** engine or API contract changes.  
- [ ] **`cashToClose`** rendered **only** from **`status`**, **`estimatedTotal`**, **`items`** — order and labels **exact**; **no** browser sum when total is **null**; **no** empty invented lines.  
- [ ] Completeness/softness comes from **`analysis`** / **`risks`** only.  
- [ ] **4xx** / **5xx** behavior matches rules above.  
- [ ] Page states **not** a final HUD/CD settlement figure.  
- [ ] Manual QA scenarios pass locally.

---

## Non-goals

No persistence, auth, PDFs, external APIs, design-system spike, no new request/response fields, no client policy, no polish beyond speed and clarity.
