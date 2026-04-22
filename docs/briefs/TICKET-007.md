# Scout brief — TICKET-007

**Status:** closed (completed — Path A)  
**Last updated:** 2026-04-18  
**Ticket:** TICKET-007 — Term Sheet Generator UI v1

---

## Problem

Reps need a **readable, shareable HTML preview** of deal terms derived from the same **`POST /api/deal/analyze`** contract as other internal tools—not a new underwriting engine, not PDF export, and not compliance automation.

## User / consumer

Internal tier-one reps drafting **indicative** term summaries for Bridge workflows. Advanced users still use **`/tools/deal-analyzer`** for raw JSON.

## Objective (v1 slice)

- Implement **Term Sheet Generator** at the **frozen route** **`/tools/term-sheet`**, replacing placeholder copy.  
- **One** guided form (purchase + refinance), **one** Analyze action, **one** HTML preview surface.  
- **Local-only** document metadata (labels, prepared-by, date) — **never** sent to the API.  
- **Reuse** shared request serialization with sibling tools; **no** new analyze request fields.

## Out of scope

- PDF/export, persistence, auth, external APIs, compliance engine, engine changes  
- Filling nulls with invented numbers or client-side policy math  

## Success criteria

- Valid **`deal_analyze.v1`** requests; preview reflects **`DealAnalyzeResponseV1`** honestly.  
- Disclaimer and copy avoid approval/commitment language.  
- After ship: hub/nav promotes Term Sheet from **Coming soon** to **Live Tools** (per TICKET-006 IA).

## Sign-off

Scout brief approved for Builder. Detailed behavior: [`docs/specs/TICKET-007.md`](../specs/TICKET-007.md).

**Closed:** Platform follow-on (auth, admin, documents, rules, analytics) is **[`PLATFORM-PATH-A.md`](../specs/PLATFORM-PATH-A.md)** — not part of TICKET-007.
