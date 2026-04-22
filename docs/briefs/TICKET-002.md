# Scout brief — TICKET-002

**Status:** closed (completed 2026-04-17)  
**Last updated:** 2026-04-17  
**Ticket:** TICKET-002 — Deal Engine policy layer on `POST /api/deal/analyze`

---

## Problem

`POST /api/deal/analyze` still reflects **stub** behavior: policy caps, product support, pricing richness, and cash-to-close structure are not grounded in a single **Deal Engine policy layer**. Reps need **consistent, explainable** outputs from the same frozen HTTP contract shipped in TICKET-001 / TICKET-001A.

## User / consumer

Internal tools calling **`POST /api/deal/analyze`** with **`schemaVersion: deal_analyze.v1`** and the existing **`deal` / `property` / `borrower`** shapes—no contract expansion.

## Objective (this ticket)

- Replace stubbed policy behavior with a **first-pass Deal Engine policy layer** behind the same route.
- **Freeze** supported Bridge **`deal.productType`** literals, value-cap precedence, recommended loan amount rule, **`loan.ltv`** unit continuity, **`pricing.status`** vocabulary, **cash-to-close** line labels, and **risk codes** per founder + business-rules docs.
- Keep **validation** and **HTTP error behavior** aligned with TICKET-001A (no narrowing validation for unsupported products—**200 + flags**).

## Out of scope

- UI redesign, persistence, PDFs, auth  
- External APIs, property engine, intelligence engine  
- New request fields or new top-level response keys  

## Success criteria

- Policy-backed **loan** recommendation and **ltv** where applicable.  
- **Unsupported** `productType` → **200** with policy flags / risks, not **400**.  
- **LTC** only internal; surfaced via **flags** / **risks**, not a new public field.  
- Labels and risk codes match **`docs/business-rules/deal-engine-v1-assumptions.md`**.  

## Sign-off

Scout brief approved for Architect → Builder handoff. Detailed behavior: [`docs/specs/TICKET-002.md`](../specs/TICKET-002.md). LTC surfacing addendum: [`docs/specs/TICKET-002A.md`](../specs/TICKET-002A.md).

**Closed:** 2026-04-17 — policy layer v1 and LTC addendum shipped; doc polish tracked as [`DOC-002`](../specs/DOC-002.md).
