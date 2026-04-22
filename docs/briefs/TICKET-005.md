# Scout brief — TICKET-005

**Status:** approved  
**Last updated:** 2026-04-17  
**Ticket:** TICKET-005 — Cash to Close Estimator UI v1

---

## Problem

Reps need a **cash-to-close-first** view of **`POST /api/deal/analyze`** without relying on JSON or the loan-centric assistant layout. The API contract and engine are frozen; the gap is a **purpose-built UI** that foregrounds **`cashToClose`** and defers loan/pricing to secondary context.

## User / consumer

Internal reps estimating cash to close for Bridge purchase and refinance. **Deal Analyzer** (`/tools/deal-analyzer`) remains the **JSON harness**; **Loan Structuring Assistant** and **Pricing Calculator** stay **unchanged** as separate tools.

## Objective (v1 slice)

- New route: **`/tools/cash-to-close-estimator`** (one page).  
- **Purchase** and **Refinance** only; same **purpose × productType** mapping as TICKET-003.  
- Collect **only** allowed request fields per the ticket’s input sets.  
- Render **server** cash-to-close lines **in order**, **labels verbatim**, **`estimatedTotal`** as the hero number — **no** client-side fee math, **no** summing items when total is null, **no** HUD/CD framing.

## Out of scope

- Contract or engine changes, client-side policy  
- Persistence, auth, PDFs, external APIs, design-system spike  
- Polish beyond speed and clarity  

## Success criteria

- One **Estimate Cash** action posts a valid **`deal_analyze.v1`** body.  
- **200** responses show cash summary → lines → analysis flags → risks → secondary loan/pricing context.  
- **4xx** shows **`error`**, **`code`**, **`issues`**.  
- **5xx** shows a generic failure state without fabricated **`issues`**.  

## Sign-off

Scout brief approved for Builder. Detailed behavior: [`docs/specs/TICKET-005.md`](../specs/TICKET-005.md).
