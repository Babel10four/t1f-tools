# Term Sheet Generator — UI notes (reference only)

**Not authoritative.** **[`TICKET-007.md`](./TICKET-007.md)** is the **single source of truth** for ticket scope, acceptance, and Builder handoff. This document is **supplemental reference** (field lists, preview order, boundaries); if anything disagrees with **TICKET-007**, follow **TICKET-007**.

**Status:** reference (freeze notes)  
**Last updated:** 2026-04-18  
**API consumer:** [`POST /api/deal/analyze`](../../src/lib/engines/http.ts) — **`schemaVersion: deal_analyze.v1`** only.  
**Policy / engine:** [`TICKET-002`](./TICKET-002.md), [`docs/business-rules/deal-engine-v1-assumptions.md`](../business-rules/deal-engine-v1-assumptions.md)

**Route discipline:** Use **`/tools/term-sheet` only.** Do **not** add **`/tools/term-sheet-generator`** or any alias. **Hub:** promote **Coming soon → Live Tools** only per **[`TICKET-007.md`](./TICKET-007.md)** when the real page is implemented and tested — not before.

**Product label (browser title + H1):** **Term Sheet Generator**

---

## 1. Route and naming

| Item | Frozen value |
|------|----------------|
| **Route** | **`/tools/term-sheet`** |
| **Page / product label** | **Term Sheet Generator** |
| **Alternate path** | **None** — no `term-sheet-generator` URL |

---

## 2. Request discipline (analyze payload)

Use the **same canonical analyze request** as sibling rep tools. **No new analyze fields.**

**Forbidden on the request:** occupancy, margins, rate locks, CRM fields, or any key not in the frozen TICKET-001/001A contract.

### Purchase flow

| Field | JSON path | Rule |
|-------|-----------|------|
| Purchase price | `deal.purchasePrice` | **Required** |
| Rehab budget | `deal.rehabBudget` | Optional; default **`0`** |
| Property value (primary) | `property.arv` | **Recommended required** |
| Requested loan amount | `deal.requestedLoanAmount` | Optional |
| Term (months) | `deal.termMonths` | Optional; **`null`** if unknown |
| FICO | `borrower.fico` | Optional |
| Experience tier | `borrower.experienceTier` | Optional |

Always: `schemaVersion: "deal_analyze.v1"`, `deal.purpose: "purchase"`, `deal.productType: "bridge_purchase"`.

### Refinance flow

| Field | JSON path | Rule |
|-------|-----------|------|
| Payoff / ask | `deal.payoffAmount` **or** `deal.requestedLoanAmount` | At least one required (same rule as siblings) |
| Property value (primary) | `property.asIsValue` | **Recommended required** |
| ARV (secondary) | `property.arv` | Optional |
| Term (months) | `deal.termMonths` | Optional; **`null`** if unknown |
| FICO | `borrower.fico` | Optional |
| Experience tier | `borrower.experienceTier` | Optional |

Always: `deal.purpose: "refinance"`, `deal.productType: "bridge_refinance"`.

---

## 3. Document-only metadata (local only)

These fields exist **only in client/React state** for preview labeling. They are **never** sent to **`/api/deal/analyze`**.

| Field | Rule |
|-------|------|
| `internalDealLabel` | Optional string |
| `counterpartyLabel` | Optional string |
| `propertyLabel` | Optional string |
| `preparedBy` | Optional string |
| `preparedDate` | Defaults to **today** (local date); user-editable |
| **Persistence** | **None** — session-only unless a future ticket adds it |

Enough for a readable preview **without** a second source of truth for deal economics.

---

## 4. HTML preview structure (fixed order)

Render sections **only** from server response + §3 metadata. **No invented sections.** **No borrower-ready legal framing.** **No PDF/export in v1.**

1. **Indicative / non-binding disclaimer** (static copy; aligns with business-rules non-binding language)  
2. **Header block**  
   - Internal deal label (`internalDealLabel`)  
   - Counterparty label (`counterpartyLabel`)  
   - Property label (`propertyLabel`)  
   - Prepared by / prepared date (`preparedBy`, `preparedDate`)  
3. **Deal identity** — `deal.purpose`, `deal.productType` (from request echo via response as applicable)  
4. **Term summary** — `loan.amount`, `loan.ltv`, `termMonths` (from response `loan` / echoed deal)  
5. **Pricing** — `pricing.status`; **only numeric pricing fields actually returned** (e.g. `noteRatePercent`, `marginBps` — omit empty panels if all null)  
6. **Cash to Close** — `cashToClose.status`, `cashToClose.estimatedTotal`, `cashToClose.items` in **exact server order** with **exact server labels**  
7. **Analysis / flags** — `analysis.status`, `analysis.flags`  
8. **Risks / next steps** — `risks` (server `title` / `detail` only)  

---

## 5. Client boundary

### Allowed

- Serialize the analyze request per §2  
- Format dates and money for display  
- Render semantic HTML for preview  
- Update §3 metadata locally → preview updates  
- Re-run **Analyze** (new `fetch`)  

### Forbidden

- Compute leverage, LTV/LTC, or pricing  
- Backfill **null** totals from line items  
- Rewrite risk **severity** or messages  
- Invent underwriting conclusions  
- Imply **approval**, **commitment**, or disclosure-grade certainty  

**Server wording stays authoritative. Gaps stay visible.**

---

## 6. State model (same as siblings)

| State | Meaning |
|-------|---------|
| `idle` | No in-flight request |
| `editing` | User changed inputs or metadata since last success (optional) |
| `submitting` | Request in flight |
| `success` | **2xx** with parsed body |
| `error_4xx` | Show **`error`**, **`code`**, **`issues`** when present |
| `error_5xx` | Network / **5xx** — generic message; **no** fabricated **`issues`** |

---

## 7. Hub / registry note

Authoritative rules: **[`TICKET-007.md`](./TICKET-007.md)** — Hub promotion happens in the **same release** as the shipped, tested implementation, **not** before.

---

## 8. Definition of done (UI implementation)

- [ ] **`/tools/term-sheet`** ships **Term Sheet Generator** UI per §2–§6.  
- [ ] No **`/tools/term-sheet-generator`** route.  
- [ ] §3 metadata never sent to the API.  
- [ ] Preview order matches §4; no PDF/export in v1.  
- [ ] States and 4xx/5xx handling match §6.  
