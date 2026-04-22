# BUILD SPEC — TICKET-003

**Status:** approved  
**Last updated:** 2026-04-17  
**Scout brief:** [`docs/briefs/TICKET-003.md`](../briefs/TICKET-003.md)  
**API contract (frozen):** [`TICKET-001`](./TICKET-001.md), [`TICKET-001A`](./TICKET-001A.md) — **no changes** in this ticket  
**Engine / policy (frozen):** [`TICKET-002`](./TICKET-002.md), [`TICKET-002A`](./TICKET-002A.md) — **no engine changes** in this ticket  
**Related UI freeze (merge deltas toward this doc):** [`loan-structuring-assistant-ui.md`](./loan-structuring-assistant-ui.md)  
**Cash to Close Estimator (sibling tool):** [`cash-to-close-estimator-ui.md`](./cash-to-close-estimator-ui.md)  
**Term Sheet Generator (authoritative):** [`TICKET-007.md`](./TICKET-007.md) — reference notes: [`term-sheet-generator-ui.md`](./term-sheet-generator-ui.md); route **`/tools/term-sheet`** only

---

## Objective

Ship the **first rep-facing Loan Structuring Assistant** on **`/tools/loan-structuring-assistant`**, backed only by **`POST /api/deal/analyze`** with **`schemaVersion: deal_analyze.v1`**.

- **Do not** change request or response contracts, **do not** add policy logic in the client, **do not** change engine code.  
- Keep **`/tools/deal-analyzer`** as a **separate internal JSON harness** (already linked from tools nav).  
- **One page**, **Purchase + Refinance** only, **one Analyze action**, minimal polish beyond clarity and speed.

---

## Routes / file plan

| Artifact | Path |
|----------|------|
| Rep-facing page (client component for form + state) | `src/app/tools/loan-structuring-assistant/page.tsx` — replace placeholder with implementation **or** `page.tsx` (server) + `loan-structuring-assistant-client.tsx` if splitting is clearer |
| Optional presentational sections | `src/app/tools/loan-structuring-assistant/` — `components/` subfolder only if files stay small; **no** shared design-system package |
| Types | Reuse **`DealAnalyzeRequestV1`**, **`DealAnalyzeResponseV1`** from `@/lib/engines/deal/schemas/*` for typing **serialization** and **response mapping** (import types only — **no** engine imports that execute policy) |
| API | `fetch("/api/deal/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body })` — same-origin only |

**Do not modify:** `src/app/api/deal/analyze/*`, `src/lib/engines/deal/*` (engine), validation modules — **unless** a type-only re-export is needed for the client (prefer importing existing response types).

---

## Form view model

**Flow selector** (`flow: "purchase" | "refinance"`):

| UI flow | `deal.purpose` | `deal.productType` |
|---------|----------------|---------------------|
| Purchase | `purchase` | `bridge_purchase` |
| Refinance | `refinance` | `bridge_refinance` |

**Purchase — fields collected (only):**

| UI | JSON path | Required |
|----|-----------|----------|
| Purchase price | `deal.purchasePrice` | Yes (submit blocked or 400 from API — **local hint** allowed) |
| Rehab budget | `deal.rehabBudget` | No — default **`0`** in serialized body |
| ARV | `property.arv` | **Recommended** (show hint; still serializable if empty if user insists — server validates per TICKET-001A) |
| Requested loan amount | `deal.requestedLoanAmount` | No |
| Term (months) | `deal.termMonths` | No — omit or `null` if empty |
| FICO | `borrower.fico` | No |
| Experience tier | `borrower.experienceTier` | No |

**Refinance — fields collected (only):**

| UI | JSON path | Required |
|----|-----------|----------|
| Payoff amount | `deal.payoffAmount` | At least one of payoff **or** requested amount (local hint + API validation) |
| Requested loan amount | `deal.requestedLoanAmount` | At least one of the two |
| As-is value | `property.asIsValue` | **Recommended primary** |
| ARV | `property.arv` | Optional secondary |
| Term (months) | `deal.termMonths` | No |
| FICO | `borrower.fico` | No |
| Experience tier | `borrower.experienceTier` | No |

**Never collect:** occupancy, pricing inputs, cash-to-close inputs, `loan`, margins, or any path not in [`DealAnalyzeRequestV1`](../../src/lib/engines/deal/schemas/canonical-request.ts).

---

## Request serialization rules

1. **Always set** `schemaVersion: "deal_analyze.v1"` (exact string).  
2. **Always set** `deal.purpose` and `deal.productType` from the flow table.  
3. **Numbers:** only JSON **numbers** in the serialized body (parse from inputs; reject/inline-validate non-numeric before submit if using controlled strings — **no** numeric strings in the wire body per TICKET-001A).  
4. **`deal.rehabBudget`:** include **`0`** when omitted on Purchase.  
5. **`deal.termMonths`:** send **`null`** when empty, or omit key only if the canonical type allows — **prefer `null`** to match existing harness patterns.  
6. **Omit** optional objects (`property`, `borrower`) when **no** fields inside are set (or send `{}` only if API accepts — follow existing validator behavior; prefer **omit** empty objects for cleanliness).  
7. **Refinance:** include `payoffAmount` and/or `requestedLoanAmount` per user input; both optional in schema but **at least one** required for successful analysis (local hint).  
8. **Do not** send `assumptions` unless explicitly added later by another ticket.

---

## Component tree (suggested)

```text
LoanStructuringAssistantPage
├── Header (title + link to /tools/deal-analyzer harness)
├── FlowSelector (Purchase | Refinance)
├── DealForm (branch by flow)
│   ├── PurchaseFields | RefinanceFields
│   └── AnalyzeButton
├── ApiStateRegion
│   ├── idle: (nothing or helper copy)
│   ├── editing: (optional “dirty” indicator — minimal)
│   ├── submitting: disabled form + loading text
│   ├── success: ResultsLayout
│   ├── error_4xx: ErrorPanel (error, code, issues[])
│   └── error_5xx: generic server error message
└── ResultsLayout (success only)
    ├── SummaryStrip (loan.amount, loan.ltv, pricing.status, cashToClose total)
    ├── CashToClosePanel (items + total)
    ├── AnalysisFlagsPanel (binding flags first, then others)
    ├── RisksPanel (by severity groups, server strings only)
    └── SecondaryDetailsPanel (termMonths, productType, ask vs recommended delta)
```

---

## API state machine

| State | Enter | UI |
|-------|--------|-----|
| `idle` | Initial load | Form ready; no results |
| `editing` | User changes any field after load or after success | Optional subtle indicator; not required for v1 |
| `submitting` | Analyze clicked | Button disabled, loading label |
| `success` | HTTP 200 + parsed JSON | Results panels |
| `error_4xx` | HTTP 400–499 | **Render `error`, `code`, `issues` (if present)** from JSON body per TICKET-001A envelope |
| `error_5xx` | HTTP 500+ or network failure | Short message; no fake contract details |

**Transitions:** Success and error return to **editing** when user changes inputs (optional) or on **Analyze** again; simplest v1: **submitting** clears prior error/success until response returns.

---

## Output mapping

### Summary strip

| Display | Source field |
|---------|----------------|
| Loan amount | `loan.amount` — show **em dash** or “—” if **undefined** (omit when unsupported / indeterminate per engine) |
| LTV | `loan.ltv` — same if missing |
| Pricing status | `pricing.status` |
| Cash to close (total) | **`cashToClose.estimatedTotal`** — **not** `total` (no such key on contract). Label in UI may read **“Cash to close (est.)”** |

### Cash to Close panel

- **`cashToClose.items`** — `label` + formatted `amount` per line.  
- Total row: use **`estimatedTotal`** (must match last line per engine rules — display as **total**).

### Binding / Analysis Flags panel

- Input: `analysis.flags[]`.  
- **Sort:** flags with `code` matching **`PURCHASE_POLICY_MAX_BINDS_LTC`** or **`PURCHASE_POLICY_MAX_BINDS_ARV`** (or future **`BINDS_*` binding-leg conventions) **first**, stable order between them (LTC then ARV).  
- **Then** all other flags in **original API order** (or alphabetical by `code` — pick one and document in code comment).

### Risks / Next Actions panel

- Group **`risks[]`** by **`severity`**: `high` → `medium` → `low` → `info` (or reverse for “next actions” emphasis — **default: high first**).  
- Within a group, preserve API order.  
- Render **`title`** and **`detail`** **verbatim** from server — **no** rewriting, **no** invented next steps.

### Secondary Details panel

| Display | Source |
|---------|--------|
| Term | `loan.termMonths` |
| Product | `loan.productType` |
| Ask vs recommended | **Client-only math:** if form had **`deal.requestedLoanAmount`** and response has **`loan.amount`**, show **delta** = `loan.amount - requestedLoanAmount` (and both numbers for context). If ask absent, show **“No ask entered”** or hide delta row. **No** policy commentary. |

### LTC display rule

- **Do not** add a dedicated **LTC %** tile or metric.  
- LTC appears only inside **`analysis.flags`**, **`risks`**, or contextual copy already returned by the API.

---

## Loading / error / empty behavior

- **Loading:** Disable Analyze + inputs (or only Analyze — minimal is OK); show **“Analyzing…”**.  
- **Empty results:** Before first success, show no results panels.  
- **Partial numbers:** Display **—** for missing **`loan.amount`** / **`ltv`** / **`estimatedTotal`** instead of **0** unless API sends **0**.  
- **4xx:** Parse JSON; show **`error`**, **`code`**, and **`issues`** list (path + message when present). Match **Deal Analyzer** harness behavior for consistency.  
- **5xx / network:** Plain error string; no fabricated **`issues`**.

---

## Client logic boundary

**Allowed:** field visibility by flow; required-field **hints** (non-blocking copy); submit/loading; success/error state; delta math ask vs **`loan.amount`**; grouping/sorting for display only.

**Forbidden:** pricing math, leverage caps, policy inference, changing severity text, invented “next steps,” duplicating engine rules in the browser.

---

## Manual QA scenarios

1. **Purchase minimal:** purchase price + ARV → **200**, summary shows amounts, flags/risks render.  
2. **Purchase** without ARV (if user clears optional) → expect **400** or **200** with incomplete per server — UI shows whatever API returns, no client override.  
3. **Refinance** payoff only + as-is → **200**.  
4. **Refinance** requested only + as-is → **200**.  
5. **Refinance** neither payoff nor requested → **400** with **`issues`** visible.  
6. **Wrong flow** switched mid-edit → new serialization (purpose/productType) on next Analyze.  
7. **Unsupported product** not applicable here (selector fixed) — **no** manual test unless devtools edits JSON.  
8. **4xx** body shows **`MISSING_COLLATERAL_VALUE`** or similar — **`code`** and **`issues`** visible.  
9. **Harness:** `/tools/deal-analyzer` still works unchanged.  
10. **No LTC tile** — only flags/risks mention LTC when server sends.

---

## Definition of done

- [ ] **`/tools/loan-structuring-assistant`** implements the form, state machine, and results layout per this spec.  
- [ ] **`/tools/deal-analyzer`** remains a separate JSON harness; nav + cross-links intact.  
- [ ] Request payloads use **only** frozen fields; flow → **`purchase`/`bridge_purchase`** or **`refinance`/`bridge_refinance`**.  
- [ ] **No** engine, validator, or route handler changes for scope creep.  
- [ ] Summary uses **`cashToClose.estimatedTotal`** for the total column (labeled clearly).  
- [ ] Binding flags sort before other flags; risks grouped by severity with **server** strings only.  
- [ ] **No** LTC numeric tile.  
- [ ] **4xx** displays **`error`**, **`code`**, **`issues`**.  
- [ ] Manual QA scenarios pass in preview/local.

---

## Non-goals (repeat)

No UI redesign system-wide, no persistence, no PDFs, no auth, no external APIs, no new request/response fields, no engine changes.
