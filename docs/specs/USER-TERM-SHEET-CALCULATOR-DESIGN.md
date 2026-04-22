# DESIGN — User-view Term Sheet Calculator + PDF (115 Lilley fidelity)

**Status:** design reference (no implementation obligation in this document)  
**Last updated:** 2026-04-22  
**Scope:** **Design only** — architecture, placement, contracts, observability, testing, rollout; **no** deal-engine contract change unless a **versioned** ticket approves it.

**Non-negotiable references (repo paths):**

| Reference | Path |
|-----------|------|
| Calculator UX (screenshots) | [`docs/TS Example/`](../TS%20Example/README.md) — screenshots per README |
| PDF golden master | [`docs/TS Example/`](../TS%20Example/README.md) — e.g. **`115 Lilley Ln, Johnson City, TN 37604.pdf`** |

**Existing internal product (this repo):**

| Area | Location |
|------|-----------|
| Route | `src/app/tools/term-sheet` — **Deal Sheet Builder** (BRAND-001); `TermSheetGeneratorClient`, `TermSheetPreview` |
| Analyze | `POST /api/deal/analyze` — unchanged contract ([`TICKET-001`](./TICKET-001.md), [`TICKET-001A`](./TICKET-001A.md)) |
| Types / PDF | `term-sheet-types.ts`, `term-sheet-pdf.ts`, `term-sheet-plain-text.ts` |

**Frozen sibling specs:**

| Spec | Relevance |
|------|-----------|
| [`TICKET-007`](./TICKET-007.md) | Internal tool: **metadata never** in analyze body; preview-first; `term_sheet_generated` **not** used for preview-only flows ([`ANALYTICS-001`](./ANALYTICS-001.md)). |
| [`ANALYTICS-001`](./ANALYTICS-001.md) / **001A** | `deal_analyze_run` + `tool_key = term_sheet` for **internal** preview; `term_sheet_generated` reserved for **real** export / `POST /api/deal/terms`. |

This design **extends** the product into a **User-view** experience (loan-scoped shell). Shared math and PDF layout should **converge** on the same modules the internal tool uses (or extracted shared package) to avoid drift.

---

## 1. C4-style context

| Layer | Responsibility |
|-------|------------------|
| **User view (browser)** | Loan-scoped shell; opens Term Sheet experience; owns form state, validation UX, optimistic UI; calls APIs; triggers PDF client-side or awaits server PDF URL. |
| **BFF / Next.js route handlers** | Session + AuthZ; proxy to engine; optional persistence (`PATCH` loan term-sheet draft); optional PDF job orchestration; **server-side** analytics where integrity matters. |
| **Deal engine** | `POST /api/deal/analyze` — **canonical** `DealAnalyzeRequestV1` → `DealAnalyzeResponseV1`. Optional structured **assumptions** already on request (e.g. `originationPointsPercent`, `originationFlatFee`, `noteRatePercent`, `borrowingRehabFunds` per engine — **no silent** `Record<string, unknown>` growth; formalize in validation / schema tickets). |
| **Persistence (optional v1+)** | Loan or child row: `term_sheet_draft` JSON + `updated_at` + `updated_by`; idempotent `PUT`/`PATCH` with `If-Match` or integer version. |
| **PDF** | **Preferred v1:** shared document module (same layout function feeding **jsPDF** — direction of current `term-sheet-pdf.ts`). **Alternative v2:** server HTML → headless Chrome for pixel-locked audits — **not** v1 default (ops cost, cold start, edge constraints). |

**Boundary:** User view **does not** embed `/tools` hub. It **reuses** shared libraries: `buildDealAnalyzeRequest`, preview row builders, `downloadTermSheetPdf` / `buildTermSheetPdfBlob` (or extracted equivalents).

---

## 2. Placement pattern (recommended)

**Choice:** Dedicated sub-route under **loan context**.

**Route shape:** `(user)/loans/[loanId]/term-sheet` — exact segment names follow the **User app** router conventions (may live outside this repo).

| Pattern | Rationale |
|---------|-----------|
| **Not modal-only** | Poor for long two-column layout, keyboard traversal, Print / Save PDF (stable document surface), refresh without heavy state sync. |
| **Not drawer-only** | Same at desktop width; deep links need extra URL sync. |
| **Sub-route wins** | Deep-linkable, back button, full height for dark two-column UI, mobile-friendly (single column or horizontal scroll for “Terms Offered”), landmarks (`main`, `h1`), optional gated email link later (`?token=`). |

**Optional:** Loan overview primary button **“Term sheet”** navigates here; same route can use full-screen sheet on small breakpoints (**responsive layout**, not a second implementation).

---

## 3. Sequence (narrative)

1. User opens loan → **Term sheet** → `GET` loan shell + optional `GET …/term-sheet` draft (or draft embedded in loan DTO).
2. Client hydrates form from draft + loan snapshot (address, tier, …); **Inputs | Terms Offered** (Terms empty or stale until analyze).
3. User edits → validation → optional debounced preview or explicit **Update Loan Terms**:
   - **v1 stub:** `POST /api/deal/analyze` only; no persistence → toast *“Preview only—changes not saved to loan.”*
   - **v1.1:** `PATCH /api/loans/:loanId/term-sheet` with draft JSON → then `POST /api/deal/analyze` with merged canonical body.
4. Server validates AuthZ → `runDealAnalyze` → JSON → log **`deal_analyze_run`** with proposed **`tool_key: term_sheet_user`** (distinct from internal `term_sheet` for KPIs — requires **ANALYTICS** ticket: constants + `resolve-analyze-context` + dashboard SQL per [ANALYTICS-001A](./ANALYTICS-001.md) pattern).
5. **Copy Terms Summary** → `buildTermSheetPlainText(viewModel)` — order identical to PDF; log **`term_sheet_summary_copied`** (new `event_type`) or bounded metadata on a generic tool event (**taxonomy ticket**).
6. **Print / Save PDF** → **v1:** client `buildTermSheetPdfBlob` → download `{slug}-term-sheet.pdf`; log **`term_sheet_generated`** with `tool_key: term_sheet_user`, metadata `{ loanId, httpStatus, bytes? }` — **align** with reserved meaning in ANALYTICS-001 (today: terms API only); product + analytics specs must **reconcile** before ship. **v2:** `POST …/term-sheet/pdf` → signed URL.

---

## 4. Component tree & state ownership

```
LoanLayout (existing User app)
└── loans/[loanId]/term-sheet/page.tsx (server: auth, loan exists)
    └── TermSheetCalculatorShell (client)
        ├── TermSheetHeader (title, instructional copy, Reset, back)
        ├── TermSheetActions
        │   ├── UpdateLoanTermsButton
        │   ├── CopyTermsSummaryButton
        │   ├── PrintSavePdfButton (hint: Save as PDF + background graphics)
        │   └── ResetButton (+ confirm if dirty && synced)
        ├── TermSheetInputsColumn (screenshot-class fields)
        │   └── controlled fields → form state (e.g. React Hook Form)
        ├── TermSheetTermsColumn (read-only + footnotes)
        │   └── rows from TermSheetTermsViewModel (derived)
        └── TermSheetDisclaimerStrip (short; full legal on PDF page 2)
```

| State | Owner | Notes |
|-------|--------|------|
| Form values | Client (RHF `defaultValues` from server draft) | URL does not hold ~20 fields; optional `?draft=rev` later. |
| Analyze result | `useQuery` / mutation cache keyed `[loanId, requestHash]` | Invalidate on successful Update. |
| Dirty / sync | `isDirty`, `lastSavedAt`, `serverVersion` | Reset → confirm if `isDirty && hasServerDraft`. |
| PDF in progress | Local `useState` | Disable double-submit; toast on failure. |

**Derived model (single source of truth):**  
`buildTermSheetTermsViewModel(request, response, metadata) → rows[]` — shared by Terms column, plain text, and PDF (labels + order).

---

## 5. API contracts

### 5.1 Existing (unchanged unless versioned extension approved)

- **`POST /api/deal/analyze`**  
  - Body: `DealAnalyzeRequestV1` (including optional **assumptions** consumed by engine).  
  - Headers: continue **`X-T1F-Tool-Key`**; User view proposes **`term_sheet_user`** (internal tool keeps **`term_sheet`**).  
  - Response: `DealAnalyzeResponseV1`.

### 5.2 New / extended (product + ticket split)

| Endpoint | Purpose | v1 |
|----------|---------|-----|
| `GET /api/loans/:loanId/term-sheet` | Draft + loan snapshot for hydration | Stub: `404` or `{ draft: null, loan: … }` |
| `PATCH /api/loans/:loanId/term-sheet` | Persist calculator draft (JSON), idempotent | Stub: `501` + `localStorage` fallback or omit until CRM |
| `POST /api/loans/:loanId/term-sheet/pdf` | Server PDF artifact | **Out of scope v1** if client PDF acceptable |

**Draft type (illustrative):**

```ts
// Draft persisted separately from DealAnalyzeRequestV1
type TermSheetDraftV1 = {
  schemaVersion: 1;
  calculator: TermSheetCalculatorInputsV1;
  metadata: TermSheetLocalMetadata;
  updatedAt: string;
  updatedByUserId: string;
};

type TermSheetCalculatorInputsV1 = {
  flow: "purchase" | "refinance";
  // Align with buildDealAnalyzeRequest + screenshot-only fields mapped to assumptions / display-only
};
```

**Backward compatibility:** New analyze fields → **assumptions** formalization + validation (`validate-deal-analyze-request`) or **`schemaVersion: deal_analyze.v2`** ticket — never unvalidated open-ended growth.

---

## 6. Single source of truth — “Terms Offered” math

| Output | Authority | Rule |
|--------|-----------|------|
| Initial / rehab / total loan, LTV, LTC, pricing echoes | **Server** (`DealAnalyzeResponseV1`) | Client must **not** re-implement policy caps. |
| Monthly IO (before/after rehab drawn) | **Shared derived module** | From server numbers + `noteRatePercent` (server or assumptions); **same** function as PDF; unit-tested. |
| Origination $ from points | **Shared derived** | e.g. `totalLoan * (points/100)` when consistent with product; rounding to cents matches PDF. |
| Initial / rehab advance % | **Engine vs display-only** | If user-editable % must drive structure → assumptions + engine; else display-only with **warning** if % ≠ implied from amounts. |

**“Update Loan Terms” (testable v1):**

- **Option A (recommended v1):** Update = re-run analyze + toast; **no** CRM write; acceptance: same request → same response hash.  
- **Option B:** `PATCH` draft + analyze; acceptance: `GET` returns saved draft; conflicts → `409` + merge UI spec.

---

## 7. Copy Terms Summary

- Format: plain text, UTF-8, `\n` line endings.  
- Order: **identical** to PDF “Inputs / Terms” logical blocks (reference **115 Lilley** where applicable).  
- Implementation: **`buildTermSheetPlainText(viewModel)`** — replace ad-hoc strings with viewModel from the **same** builder as PDF.

---

## 8. PDF fidelity checklist (vs 115 Lilley)

| # | Element | Match strategy |
|---|---------|----------------|
| 1 | Letter 612×792, margins | Shared constants; snapshot test page size. |
| 2 | Page 1: T1F block + rule | Green tile + right stack; PNG visual diff. |
| 3 | Title, property, prepared | Typography scale (pt) vs reference. |
| 4 | Inputs / Terms two columns | Column widths; muted labels / bold values; right-align values. |
| 5 | Row set parity with screenshots | Field list from TS Example; missing engine fields → assumptions or footnotes. |
| 6 | Footnotes (inspection, prepay) | Static `TERM_SHEET_FOOTNOTES_V1` module. |
| 7 | Page 2: thick rule, disclaimer | Same copy class; line width pt. |
| 8 | Signature grid | Prepared By / Date / Accepted By / Date. |
| 9 | Footer | Centered; optional `schemaVersion` in metadata only. |
| 10 | Filename | `{sanitized(propertyLabel)}-term-sheet.pdf` (product rule). |

**Strategy:** **(A)** Reuse/extend shared **jsPDF** module — offline-friendly, no Puppeteer SSR for v1. **Accessibility:** HTML calculator remains primary; PDF is export artifact.

---

## 9. AuthZ matrix (example — align to product roles)

| Role | View calculator | Edit inputs | Update / persist draft | Export PDF |
|------|-----------------|------------|------------------------|------------|
| Borrower | Yes | No (read-only locked terms) | No | Yes if policy allows |
| Loan officer | Yes | Yes | Yes | Yes |
| Processor / admin | Yes | Yes | Yes | Yes |
| Anonymous | No | No | No | No |

Enforce on `PATCH` and optionally on `POST` analyze when analyze becomes loan-bound.

---

## 10. Observability (align ANALYTICS-001)

**Implementation note:** New `event_type` / `tool_key` values require updates to [`src/lib/analytics/constants.ts`](../../src/lib/analytics/constants.ts), logging sites, and dashboard SQL — **separate ticket** from this design doc.

| Event | `event_type` (proposal) | `tool_key` (proposal) | Metadata (bounded) |
|-------|-------------------------|-------------------------|---------------------|
| Calculator opened | `term_sheet_calculator_opened` | `term_sheet_user` | `{ loanId, route }` |
| Analyze / Update success | `deal_analyze_run` | `term_sheet_user` | `{ loanId, result: analysis.status }` |
| Analyze fail | `deal_analyze_run` | `term_sheet_user` | `{ loanId, status: error, message }` |
| PDF generated | `term_sheet_generated` | `term_sheet_user` | `{ loanId, bytes?, durationMs? }` — **reconcile** with reserved meaning for `/api/deal/terms` |
| PDF failed | `term_sheet_generated` | `term_sheet_user` | `{ status: error, message }` |
| Copy summary | `term_sheet_summary_copied` | `term_sheet_user` | `{ loanId, charCount }` |

**Dashboard:** Extend KPI SQL: `tool_key IN ('term_sheet','term_sheet_user')` for previews, or separate tiles **Internal** vs **User** per product.

---

## 11. Testing

| Layer | Tests |
|-------|--------|
| Money / rate / IO | Unit tests on `buildTermSheetTermsViewModel` (fixtures from 115 Lilley numbers). |
| API | Contract: `POST /api/deal/analyze` with `X-T1F-Tool-Key: term_sheet_user` persists correct analytics row (after constants exist). |
| PDF | Golden: hash of PDF bytes for fixed fixture, or per-page PNG diff (`pdftoppm`) with CI threshold. |
| E2E | Playwright: open route → fill → Update → Terms column strings → download PDF → non-empty file. |

---

## 12. Rollout

- **Feature flag:** `user_term_sheet_calculator` (env or remote config).  
- **Fallback:** PDF throws → “Print” instructions + Copy summary; log `term_sheet_generated` **error**.  
- **Internal tools:** Keep `/tools/term-sheet`; optionally wrap shared **TermSheetCalculatorShell** with `variant="internal"` (lighter chrome) to avoid drift.

---

## 13. Acceptance criteria (product)

1. From User view, user opens standalone Term Sheet sub-route; **dark UI**; screenshot-class inputs; validation + empty states.  
2. **Terms Offered** updates correctly after **Update Loan Terms** (v1 = analyze success path defined and testable).  
3. Download PDF is **layout-substitutable** for stakeholder review: “same document as 115 Lilley, different numbers” per checklist §8.  
4. **Copy Terms Summary** matches on-screen / PDF order.  
5. AuthZ enforced (edit vs read-only).  
6. Analytics events emitted per agreed taxonomy ticket.

---

## 14. Non-goals (confirmed)

- No compliance engine, no credit decisioning, no commitment language beyond disclaimer class.  
- No full internal hub embedded in User view.

---

## 15. Implementation tickets (suggested split)

1. **Analytics + tool key:** Add `term_sheet_user`, new event types, `resolve-analyze-context`, dashboard KPI SQL — **depends on** ANALYTICS-001A pattern.  
2. **Shared view model + plain text:** `buildTermSheetTermsViewModel` + refactor `buildTermSheetPlainText` / PDF to consume it (can start in **this** repo even before User app exists).  
3. **User app route + shell:** Loan layout + `TermSheetCalculatorShell` + v1 Option A analyze-only.  
4. **Persistence:** `GET`/`PATCH` loan term-sheet draft when CRM exists.  
5. **PDF golden CI:** Assets under `docs/TS Example/` + visual/hash tests.
