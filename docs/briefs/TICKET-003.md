# Scout brief — TICKET-003

**Status:** approved  
**Last updated:** 2026-04-17  
**Ticket:** TICKET-003 — Loan Structuring Assistant UI v1

---

## Problem

Reps need a **first real internal UI** to run **`POST /api/deal/analyze`** without editing JSON. The API and policy stack are frozen (TICKET-001/001A/002/002A); the gap is **discoverable fields**, **clear flow selection**, and **readable results** aligned to the contract.

## User / consumer

Internal reps structuring Bridge purchase and refinance scenarios. **Deal Analyzer** at **`/tools/deal-analyzer`** remains the **JSON harness** for contract debugging.

## Objective (v1 slice)

- New rep-facing route: **`/tools/loan-structuring-assistant`** (one page).  
- **Purchase** and **Refinance** flows only; selector maps **exactly** to frozen `purpose` × `productType` pairs.  
- Collect **only** fields allowed by the frozen request contract and the ticket’s **exact v1 input sets** per flow.  
- Render **summary**, **cash to close**, **flags**, **risks**, and **secondary details** per BUILD SPEC — **server wording only** for risks; no client policy.  
- **No** LTC tile unless the API adds a numeric LTC field; LTC stays flags/risks context only.

## Out of scope

- Request/response contract changes, engine changes, policy in the client  
- Persistence, PDFs, auth, external APIs, design-system spike  
- UI polish beyond clarity and speed  

## Success criteria

- One **Analyze** action builds a valid **`deal_analyze.v1`** body and displays a **200** response layout per spec.  
- **4xx** shows **`error`**, **`code`**, **`issues`** when present.  
- Harness and assistant remain **separate routes**.  

## Sign-off

Scout brief approved for Builder. Detailed behavior: [`docs/specs/TICKET-003.md`](../specs/TICKET-003.md).
