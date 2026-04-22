# BUILD SPEC — TICKET-004 — Pricing Calculator UI v1

**Status:** draft (Scout-approved brief)  
**Last updated:** 2026-04-17  
**API contract (frozen):** [`TICKET-001`](./TICKET-001.md), [`TICKET-001A`](./TICKET-001A.md) — **no changes** in this ticket  
**Engine / policy (frozen):** [`TICKET-002`](./TICKET-002.md), [`TICKET-002A`](./TICKET-002A.md) — **no engine changes** in this ticket  
**Prerequisite UIs (do not regress):** [`TICKET-003`](./TICKET-003.md) — Loan Structuring Assistant; internal JSON harness below  

---

## Objective

Ship a **pricing-first** internal tool on **`/tools/pricing-calculator`**, backed only by **`POST /api/deal/analyze`** with **`schemaVersion: deal_analyze.v1`**.

- **Pricing is the hero:** the default layout leads with **`pricing`** and pricing-adjacent **readiness signals** from the server (`pricing.status`, then flags/risks), not loan sizing or cash-to-close.  
- **Do not** change request or response contracts, **do not** add policy or pricing math in the client, **do not** change engine code.  
- Keep **`/tools/deal-analyzer`** as the **internal JSON harness** (unchanged).  
- Keep **`/tools/loan-structuring-assistant`** **intact** (same route, behavior, and tests; no breaking edits).  
- **One page**, **Purchase + Refinance** only, **one Analyze** action, minimal polish beyond clarity and speed.

---

## Architect findings (frozen from codebase)

### Canonical request (`DealAnalyzeRequestV1`)

Source: `src/lib/engines/deal/schemas/canonical-request.ts`

- **`schemaVersion`:** must be exactly `deal_analyze.v1`.  
- **`deal`:** `purpose`, `productType`, `rehabBudget` (number), `termMonths` (number \| null); optional `purchasePrice`, `payoffAmount`, `requestedLoanAmount` per purpose rules.  
- **`property` (optional):** `arv?`, `asIsValue?`.  
- **`borrower` (optional):** `fico?`, `experienceTier?`.  
- **`assumptions`:** optional; **do not** send unless a future ticket explicitly adds UI for it.

No other top-level keys are part of the frozen contract.

### Canonical response — **pricing field inventory** (`DealAnalyzePricingOutV1`)

Source: `src/lib/engines/deal/schemas/canonical-response.ts`

The **only** pricing-specific fields in the **200** response are under **`pricing`**:

| Field | Type | Notes |
|-------|------|--------|
| **`status`** | `DealAnalyzePricingStatus` | See enum below. |
| **`noteRatePercent`** | `number \| null` | v1 engine currently returns **`null`** for supported deals. |
| **`marginBps`** | `number \| null` | v1 engine currently returns **`null`**. |
| **`discountPoints`** | `number \| null` | v1 engine currently returns **`null`**. |
| **`lockDays`** | `number \| null` | v1 engine currently returns **`null`**. |

**`DealAnalyzePricingStatus`** (source: `src/lib/engines/deal/schemas/deal-engine-v1-enums.ts`):

`stub` | `complete` | `indicative` | `insufficient_inputs` | `needs_review`

**Important:** The UI **must not** invent additional pricing columns (e.g. “APR”, “spread”) — only these five keys exist on **`pricing`**. Readiness when scalars are **`null`** must be explained using **server outputs** (`pricing.status`, **`analysis.flags`**, **`risks`**, **`analysis.status`**) — not client rules.

### Other response slices (secondary for this page)

- **`analysis`:** `status`, `flags[]` — use for “blockers / incomplete” copy **verbatim** (`message`, `code`, `severity`).  
- **`risks`:** `title`, `detail`, `severity`, `code` — verbatim; group by severity for display only.  
- **`loan`:** echo + `amount?`, `ltv?` — secondary strip.  
- **`cashToClose`:** optional collapsed section only; **`cashToClose.status`** often mirrors pricing status in v1 but is **not** a pricing field.

---

## Narrowest useful input set (inside frozen contract)

Goal: maximize the chance of **supported** `bridge_*` analysis and **meaningful `pricing.status`** without collecting forbidden fields.

**Flow mapping (required):**

| UI flow | `deal.purpose` | `deal.productType` |
|---------|----------------|---------------------|
| Purchase | `purchase` | `bridge_purchase` |
| Refinance | `refinance` | `bridge_refinance` |

**Purchase — collect only:**

| UI label | JSON path | Required for “happy path” hint |
|----------|-----------|--------------------------------|
| Purchase price | `deal.purchasePrice` | Yes (validator) |
| Rehab budget | `deal.rehabBudget` | No — default **0** if empty |
| ARV | `property.arv` | Strongly recommended (collateral / LTV path) |
| Requested loan | `deal.requestedLoanAmount` | No |
| Term | `deal.termMonths` | No — **`null`** if empty |
| **FICO** | `borrower.fico` | **Strongly recommended** — drives `pricing.status` vs stub on supported deals |
| Experience tier | `borrower.experienceTier` | No |

**Refinance — collect only:**

| UI label | JSON path | Required for “happy path” hint |
|----------|-----------|--------------------------------|
| Payoff | `deal.payoffAmount` | At least one of payoff **or** requested |
| Requested loan | `deal.requestedLoanAmount` | At least one of the two |
| As-is | `property.asIsValue` | Strongly recommended |
| ARV | `property.arv` | No |
| Term | `deal.termMonths` | No — **`null`** if empty |
| **FICO** | `borrower.fico` | **Strongly recommended** |
| Experience tier | `borrower.experienceTier` | No |

**Never collect:** occupancy, margins, rate locks as inputs, `loan`, `pricing`, `cashToClose`, or any path not on `DealAnalyzeRequestV1`.

---

## Request serialization rules

1. **`schemaVersion`:** always `"deal_analyze.v1"`.  
2. **Flow:** set `deal.purpose` and `deal.productType` from the mapping table.  
3. **Numbers:** only JSON **numbers** on the wire (parse from inputs; block or inline-validate non-numeric before submit).  
4. **`deal.rehabBudget`:** on Purchase, send **`0`** when omitted.  
5. **`deal.termMonths`:** prefer **`null`** when empty.  
6. **Omit** empty `property` / `borrower` objects (no `{}` unless validator explicitly accepts — match existing harness behavior).  
7. **Refinance:** at least one positive **`payoffAmount`** or **`requestedLoanAmount`** (local hint + server validation).  
8. **Do not** send `assumptions` in v1 of this ticket.

*(Serialization may reuse the same patterns as [`TICKET-003`](./TICKET-003.md) via shared pure helpers in a small module — optional implementation detail; not required by this spec.)*

---

## Component tree (suggested)

```text
PricingCalculatorPage
├── Header (title + links: /tools/deal-analyzer harness, /tools/loan-structuring-assistant)
├── FlowSelector (Purchase | Refinance)
├── DealForm
│   ├── PurchaseFields | RefinanceFields
│   └── AnalyzeButton
├── ApiStateRegion
│   ├── idle / editing / submitting / success / error_4xx / error_5xx
│   └── (same state machine semantics as TICKET-003)
└── ResultsLayout (success only)
    ├── PricingSummaryStrip
    │     ├── pricing.status (prominent)
    │     └── Stable row order: noteRatePercent → marginBps → discountPoints → lockDays
    │         (label each; show "—" or explicit copy when null — no fake numbers)
    ├── PricingContextPanel (optional heading)
    │     └── analysis.flags (server messages only; binding-leg flags allowed but not “pricing math”)
    ├── RisksPanel (severity groups, verbatim title/detail)
    ├── SecondaryContextPanel
    │     ├── loan.amount, loan.ltv, loan.termMonths, loan.productType
    │     └── (optional) harmless delta vs last submitted requestedLoanAmount if present
    └── CollapsedCashToClose (optional <details>)
          └── cashToClose.status, estimatedTotal, items — not primary
```

---

## API state machine

| State | Enter | UI |
|-------|--------|-----|
| `idle` | Initial load | Form ready; no results |
| `editing` | User changed inputs after load or after a run | Optional “Editing” hint |
| `submitting` | Analyze clicked | Disable form + “Analyzing…” |
| `success` | HTTP 200 + parsed JSON | Results layout |
| `error_4xx` | HTTP 400–499 | **`error`**, **`code`**, **`issues`** from body |
| `error_5xx` | HTTP 500+ or network failure | Short message; no fabricated issues |

**Transitions:** Match TICKET-003: submitting clears prior success/error until response; may keep last success visible while editing until next submit (implementation choice; document in code comment).

---

## Output mapping (v1 order — pricing first)

### 1. Pricing summary strip

| Display | Source |
|---------|--------|
| Status | **`pricing.status`** (required) |
| Note rate | **`pricing.noteRatePercent`** — if `null`, show em dash or “Not provided” **without** inferring why |
| Margin | **`pricing.marginBps`** |
| Points | **`pricing.discountPoints`** |
| Lock | **`pricing.lockDays`** |

**Stable field order:** `status` first (visual leader), then **`noteRatePercent` → `marginBps` → `discountPoints` → `lockDays`**.

When **all** scalars are **`null`**, the strip **still** shows **`pricing.status`** and may add a **single** line of neutral copy such as “No rate fields returned for this run.” **Do not** explain missing FICO or policy in the client — use flags/risks below for server wording.

### 2. Pricing blockers / analysis flags

- Source: **`analysis.flags[]`**.  
- Render **`message`** (and `code` if useful) **verbatim**.  
- Sort: optional — may mirror TICKET-002A binding-flag order if reusing shared display helper; otherwise preserve API order.

### 3. Risks / next actions

- Source: **`risks[]`**.  
- Group by **`severity`** (high → medium → low → info); preserve order within group.  
- **`title`** and **`detail`** verbatim.

### 4. Secondary context

- **`loan.amount`**, **`loan.ltv`**, **`loan.termMonths`**, **`loan.productType`** — formatted display only.  
- Optional delta: **`loan.amount - deal.requestedLoanAmount`** only when both are numbers from **response + last request snapshot** (same rule as TICKET-003).

### 5. Optional collapsed: cash to close

- **`cashToClose.status`**, **`estimatedTotal`**, **`items`** — not in the primary fold; `<details>` or equivalent.

---

## Loading / error / empty behavior

- **Loading:** disable Analyze (and optionally inputs); show “Analyzing…”.  
- **Null pricing scalars:** never substitute zeros unless the API sends **`0`**.  
- **Unsupported product:** not applicable if flow is fixed to `bridge_*`; if extended later, follow server **`pricing.status: stub`** and risks.  
- **4xx:** same envelope as deal-analyzer / loan assistant (`error`, `code`, `issues[]`).  
- **5xx / network:** plain error string.

---

## Client logic boundary

**Allowed:** flow selection; field visibility; parse/serialize; loading/error state; display formatting; flag sort / risk grouping; optional ask-vs-amount delta; collapsible sections.

**Forbidden:** computing rates, margins, points, locks; inferring “ready for pricing” from FICO alone; duplicating engine policy text beyond displaying server strings.

---

## Route / file plan

| Artifact | Path |
|----------|------|
| Page (server) + metadata | `src/app/tools/pricing-calculator/page.tsx` |
| Client UI | `src/app/tools/pricing-calculator/pricing-calculator-client.tsx` (or equivalent single file) |
| Optional pure helpers | `src/app/tools/pricing-calculator/*` — serialize + display-only helpers; **no** new packages |
| Types | Import **`DealAnalyzeRequestV1`**, **`DealAnalyzeResponseV1`**, **`DealAnalyzePricingOutV1`** from `@/lib/engines/deal/schemas/*` (types only) |
| API | `fetch("/api/deal/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body })` |

**Do not modify:** `src/app/api/deal/analyze/*`, `src/lib/engines/deal/*` (engine).  
**Nav:** add **`/tools/pricing-calculator`** to `src/app/tools/layout.tsx` alongside existing tools.

---

## Manual QA scenarios

1. **Purchase + price + ARV + FICO** → **200**; pricing strip shows **`pricing.status`**; null rate fields render as empty/—; flags/risks verbatim.  
2. **Purchase without FICO** → **200** if valid; **`pricing.status`** may be **`indicative`** or similar — UI shows status **without** claiming “missing FICO” unless a **risk/flag** says so.  
3. **Refinance payoff + as-is + FICO** → **200**; secondary loan line shows amount/LTV when present.  
4. **Refinance missing both payoff and requested** → **400**; **`issues`** visible.  
5. **Switch flow mid-edit** → next Analyze sends correct **`purpose` / `productType`**.  
6. **`/tools/deal-analyzer`** still runs raw JSON.  
7. **`/tools/loan-structuring-assistant`** unchanged (smoke + existing tests green).  
8. No invented pricing columns beyond the five **`pricing`** keys.

---

## Definition of done

- [ ] **`/tools/pricing-calculator`** exists and is linked from tools nav.  
- [ ] Uses **only** frozen request fields; flow → **`purchase`/`bridge_purchase`** or **`refinance`/`bridge_refinance`**.  
- [ ] **Pricing block is first** in success layout; displays **only** `DealAnalyzePricingOutV1` keys + `pricing.status`.  
- [ ] **No** client-side pricing/leverage/risk semantics; **server strings** for flags/risks.  
- [ ] **4xx** shows **`error`**, **`code`**, **`issues`**.  
- [ ] **No** engine, validator, or contract changes.  
- [ ] **Loan Structuring Assistant** and **Deal Analyzer** unchanged in behavior.  
- [ ] Manual QA scenarios pass locally.

---

## Non-goals

No design-system rollout, no persistence, no PDFs, no auth, no external APIs, no new request/response fields, no engine changes, no duplicate product surface beyond the pricing-first layout distinction from the Loan Structuring Assistant.
