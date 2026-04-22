# BUILD SPEC — TICKET-007

**Authoritative spec:** **This file (`TICKET-007.md`) is the source of truth** for Builder and Architect. [`term-sheet-generator-ui.md`](./term-sheet-generator-ui.md) is **reference only** (extended notes); if anything conflicts, **this spec wins**.

**Status:** closed (completed — Path A)  
**Last updated:** 2026-04-18  
**Scout brief:** [`docs/briefs/TICKET-007.md`](../briefs/TICKET-007.md)  
**API contract (frozen):** [`TICKET-001`](./TICKET-001.md), [`TICKET-001A`](./TICKET-001A.md) — **no changes**  
**Engine (frozen):** no redesign; **no** new analyze inputs  
**Hub / nav context:** [`TICKET-006`](./TICKET-006.md) — see [Hub promotion](#hub-promotion-coming-soon--live-tools) below  
**Reference notes only:** [`term-sheet-generator-ui.md`](./term-sheet-generator-ui.md)

---

## Frozen decisions (non-negotiable)

| Topic | Decision |
|-------|----------|
| **Route** | **`/tools/term-sheet`** only — no alternate path (e.g. no `/tools/term-sheet-generator`). |
| **Metadata** | `internalDealLabel`, `counterpartyLabel`, `propertyLabel`, `preparedBy`, `preparedDate` stay **local to the page** (React state + preview DOM). They **must never** be sent in the body to **`/api/deal/analyze`**. |
| **Export / v1 delivery** | **Semantic HTML preview only** for v1. **No** PDF export, **no** print/PDF **product** work in this ticket (no print stylesheets, download buttons, or “Export PDF” as a feature). **Browser Print** (`Cmd/Ctrl+P`) may still occur as ordinary user behavior on the page — do **not** build ticket scope around it. |
| **Hub promotion** | Move **Term Sheet Generator** from **Coming soon** → **Live Tools** in **`tools-registry.ts`** in the **same release** as the **real** implemented, **tested** page — **not** before. Placeholder-only routes stay under Coming soon until then. |

---

## Objective

Ship the **first internal Term Sheet Generator** at **`/tools/term-sheet`**: an **HTML preview** built on **`POST /api/deal/analyze`** (`schemaVersion: deal_analyze.v1`), **not** a PDF system, **not** a compliance engine, **not** a new underwriting surface.

- **Reuse** `/api/deal/analyze` **unchanged** unless a **documented blocker** forces otherwise (unexpected for v1).  
- **No** engine work, **no** new analyze request fields, **no** auth, persistence, PDFs, external APIs.  
- **Keep** sibling tools intact: deal-analyzer, loan-structuring-assistant, pricing-calculator, cash-to-close-estimator.

**Product label / page title:** **Term Sheet Generator** (replaces coming-soon placeholder content on **`/tools/term-sheet`**).

---

## Route / file plan

| Artifact | Path |
|----------|------|
| Route entry (server) | `src/app/tools/term-sheet/page.tsx` — export metadata; render **`TermSheetGeneratorClient`** (or default export client wrapper). |
| Client UI | `src/app/tools/term-sheet/term-sheet-generator-client.tsx` — form + metadata panel + preview + `fetch` to **`/api/deal/analyze`**. |
| Optional tests | `src/app/tools/term-sheet/term-sheet-generator.test.tsx` — patterns aligned with [`loan-structuring-assistant.test.tsx`](../../src/app/tools/loan-structuring-assistant/loan-structuring-assistant.test.tsx). |

**Do not modify:** `src/app/api/deal/analyze/*`, `src/lib/engines/deal/*` (engine), except **type-only** imports for client typing.

**Shared request builder (reuse)**

- **Direct import** of [`buildDealAnalyzeRequest`](../../src/app/tools/loan-structuring-assistant/build-deal-analyze-request.ts) with the same **`LoanAssistantFlow`** / **`LoanAssistantFields`** types as Loan Structuring Assistant, Pricing Calculator, and Cash to Close Estimator — **no** wrapper unless a single thin re-export reduces duplication noise (optional).  
- **Do not fork** serialization logic in TICKET-007.

### Hub promotion (Coming soon → Live Tools)

- **When:** Same release as a **fully implemented and tested** Term Sheet Generator per this spec — **not** on placeholder or spec-only landings.  
- **What:** Move **`/tools/term-sheet`** from **`COMING_SOON_TOOLS`** to **`LIVE_TOOLS`** in [`src/app/tools/tools-registry.ts`](../../src/app/tools/tools-registry.ts); update hub card copy on [`src/app/tools/page.tsx`](../../src/app/tools/page.tsx) per [`TICKET-006`](./TICKET-006.md) (preview-oriented; not PDF/export).  
- **Coordinate** with nav so the hub never shows “coming soon” while the live tool is incomplete, or “live” while only a stub exists.

---

## Exact input model (analyze)

Same as sibling tools — **Purchase** and **Refinance** only.

**Purchase**

- `deal.purpose`: `"purchase"`  
- `deal.productType`: `"bridge_purchase"`  
- `deal.purchasePrice` — required (client hint + API validation)  
- `deal.rehabBudget` — optional; default **`0`** in serialized body  
- `property.arv` — recommended primary  
- `deal.requestedLoanAmount`, `deal.termMonths`, `borrower.fico`, `borrower.experienceTier` — optional  

**Refinance**

- `deal.purpose`: `"refinance"`  
- `deal.productType`: `"bridge_refinance"`  
- `deal.payoffAmount` **or** `deal.requestedLoanAmount` — at least one  
- `property.asIsValue` — recommended primary  
- `property.arv` — optional secondary  
- `deal.termMonths`, `borrower.fico`, `borrower.experienceTier` — optional  

**Never send:** occupancy, pricing, `cashToClose`, `loan`, margins, CRM fields, or any path not on [`DealAnalyzeRequestV1`](../../src/lib/engines/deal/schemas/canonical-request.ts).

---

## Metadata model (local-only — **not** in API body)

| Field | Type | Rules |
|--------|------|--------|
| `internalDealLabel` | string | Optional; trim; empty → omit from preview header row or show **—**. |
| `counterpartyLabel` | string | Optional |
| `propertyLabel` | string | Optional |
| `preparedBy` | string | Optional |
| `preparedDate` | string | **Default:** today’s date in **local** date (implementation: `YYYY-MM-DD` in state **or** display from `new Date()`); **editable** text input so reps can override. **Never** sent to analyze. |

These fields exist **only** in React state and the **preview DOM** — **not** in `JSON.stringify` to `/api/deal/analyze`.

---

## Request serialization rules

1. **`schemaVersion`:** `"deal_analyze.v1"` via **`buildDealAnalyzeRequest`**.  
2. **JSON numbers only** for numeric deal/property/borrower fields.  
3. **`deal.rehabBudget`:** **`0`** when omitted on purchase.  
4. **`deal.termMonths`:** **`null`** when empty (shared helper behavior).  
5. **Omit** empty `property` / `borrower` objects.  
6. **No** `assumptions` unless a future ticket adds it.  
7. **Metadata** never merged into the request object.

---

## Preview component tree (suggested)

```text
TermSheetGeneratorClient
├── Header (title + link to /tools/deal-analyzer)
├── Form (flow selector + branch fields) — data-testid: ts-form
├── MetadataPanel — local-only fields
├── Primary button: Analyze (or "Generate preview")
├── Error panels (4xx / 5xx)
└── PreviewSurface (visible on success)
    ├── DisclaimerBlock (indicative / non-binding)
    ├── HeaderBlock (metadata labels + preparedBy / preparedDate)
    ├── DealIdentitySection (purpose, productType from response.loan)
    ├── TermSummarySection (loan.amount, loan.ltv, termMonths)
    ├── PricingSection (pricing.status + numeric fields only if present)
    ├── CashToCloseSection (status, estimatedTotal, items in server order)
    ├── AnalysisFlagsSection (analysis.status + flags — server wording)
    └── RisksSection (risks — grouped by severity, server title/detail)
```

Use **semantic HTML** (`<article>`, `<section>`, `<header>`, `<dl>` where appropriate) for the preview; **no** PDF layout fidelity requirement.

---

## Output mapping (`DealAnalyzeResponseV1` → preview)

Source type: [`DealAnalyzeResponseV1`](../../src/lib/engines/deal/schemas/canonical-response.ts).

| Preview section | Source fields |
|-----------------|---------------|
| **Disclaimer** | Static copy only (see [Disclaimer / copy rules](#disclaimer--copy-rules)). |
| **Header block** | **Local only:** `internalDealLabel`, `counterpartyLabel`, `propertyLabel`, `preparedBy`, `preparedDate`. |
| **Deal identity** | `loan.purpose`, `loan.productType` |
| **Term summary** | `loan.amount`, `loan.ltv`, `loan.termMonths` |
| **Pricing** | `pricing.status`; `noteRatePercent`, `marginBps`, `discountPoints`, `lockDays` — **only** render fields that exist on the response object; display **`null`** as **—** / “Not returned” — **no** fabricated numbers. |
| **Cash to close** | `cashToClose.status`, `cashToClose.estimatedTotal`, `cashToClose.items` — **exact server order** and **labels**; **no** summing items for total; if `estimatedTotal === null`, show **not returned** / **—**. |
| **Analysis** | `analysis.status`, `analysis.flags[]` (`message` verbatim; optional `code` for display) |
| **Risks** | `risks[]` — `title`, `detail`, `severity` for grouping; **no** rewriting |

---

## Disclaimer / copy rules

- Lead with **indicative / non-binding** language: internal workflow preview only; **not** a commitment, **not** a rate lock, **not** regulatory disclosure.  
- **Forbidden:** “approved,” “final,” “guaranteed,” “HUD,” “CD,” “settlement statement,” or borrower-facing commitment tone.  
- **Do not** imply the API output is underwriting approval.

---

## State machine

| State | Behavior |
|-------|----------|
| `idle` | Initial load |
| `editing` | User changed form or metadata after load or after a run |
| `submitting` | POST in flight; disable submit; prevent double-submit |
| `success` | 200 + parsed `DealAnalyzeResponseV1`; show preview |
| `error_4xx` | Show **`error`**, **`code`**, **`issues`** if present |
| `error_5xx` | Generic message; **no** fabricated **`issues`** |

---

## Null / incomplete response fields

- **`loan.amount` / `loan.ltv` / `loan.termMonths`:** show **—** or “Not returned” where appropriate; **no** client-side derivation.  
- **`pricing` scalars:** **`null`** → display-only placeholder; **no** filling from other fields.  
- **`cashToClose.estimatedTotal === null`:** do **not** sum `items`; show total as unavailable / not returned.  
- **`cashToClose.items.length === 0`:** state explicitly that no line items were returned.  
- **`risks` / `flags` empty:** show empty section or short “None returned” — **no** invented risks.

---

## Loading / error / empty behavior

- **Loading:** “Analyzing…” or “Generating preview…”; disable primary button.  
- **Success with sparse data:** preview still renders all sections; **honest** empties.  
- **4xx:** Parse JSON envelope per TICKET-001A.  
- **5xx / network:** Generic error; no fake `issues` array.

---

## Manual QA scenarios

1. **Purchase** happy path → preview shows all sections; request uses `bridge_purchase`.  
2. **Refinance** happy path → `bridge_refinance`.  
3. **Metadata** appears in preview header only; **absent** from `fetch` body (inspect Network).  
4. **`preparedDate`** defaults to today; editable.  
5. **Null pricing scalars** → **—**, not invented values.  
6. **`estimatedTotal` null** with items → no client sum for total.  
7. **4xx** → error + code + issues.  
8. **5xx** → generic error.  
9. **Double-submit** prevented while submitting.  
10. **Edit + re-run** updates preview.  
11. **Hub/nav:** Term Sheet listed under **Live Tools** with preview copy.  
12. Sibling tool routes still load.

---

## Definition of done

- [x] **`/tools/term-sheet`** implements form + metadata + HTML preview per this spec.  
- [x] **Analyze** uses **`buildDealAnalyzeRequest`**; **no** metadata in API body.  
- [x] Preview order: disclaimer → header (metadata) → deal identity → term summary → pricing → cash to close → analysis → risks.  
- [x] **No** PDF/export, **no** engine changes, **no** new analyze fields.  
- [x] Copy complies with [Disclaimer / copy rules](#disclaimer--copy-rules).  
- [x] Hub/nav updated: Term Sheet in **Live Tools** (TICKET-006 alignment).  
- [x] Manual QA scenarios pass.  
- [x] Metadata in root `term-sheet/page.tsx` points at **`docs/specs/TICKET-007.md`**.

---

## Closure (Path A)

**Closed:** Term Sheet Generator shipped per this spec. **Platform-wide app auth, admin shell, documents, rule sets, and analytics** are **out of scope for TICKET-007** and are defined in [`PLATFORM-PATH-A.md`](./PLATFORM-PATH-A.md) and **`ACCESS-001` / `ADMIN-001` / `CONTENT-*` / `CONFIG-*` / `ANALYTICS-001`**.

---

## Non-goals (TICKET-007 scope only)

PDF generation; **print/PDF product features** in v1 (including dedicated print CSS, export buttons, or “save as PDF” flows); **in-ticket** persistence or **in-ticket** auth (platform auth is a **separate** epic); compliance checks; underwriting logic in the client; design-system spike; hidden engine work.
