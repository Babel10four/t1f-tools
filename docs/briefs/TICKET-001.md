# Scout brief — TICKET-001

**Status:** closed (completed 2026-04-16)  
**Last updated:** 2026-04-16  
**Ticket:** TICKET-001 — Canonical deal analyze API (v1)

---

## Problem

The portfolio needs a single, explicit HTTP contract for **deal analysis** so multiple tools (structuring, pricing surface, cash-to-close surface) can share one backend without ambiguous shapes (`loan` at top level vs nested, request vs response fields). Today’s risk is **contract drift** and **silent misinterpretation** of payloads.

## User / consumer

Internal tools and API clients posting JSON to **`POST /api/deal/analyze`**. First consumer is minimal verification UI on the deal analyzer tool page.

## Objective (v1 slice)

- Canonical request: **`schemaVersion`**, **`deal`**, optional **`borrower`**, **`property`**, **`assumptions`**.
- **`loan`**, **`pricing`**, and **`cashToClose`** are **outputs only** on the public contract.
- **Hybrid validation:** **400** for malformed or insufficient-to-analyze payloads; **200** when analyzable, including **incomplete** scenarios with structured flags (not a separate HTTP success class).
- **Stub engine only:** illustrative outputs; no real pricing engine, no PDFs, no persistence, no auth.

## Out of scope (frozen for this ticket)

- Real pricing engine or investor matrices  
- PDF / document generation  
- Database or session persistence  
- Authentication / authorization  
- Product UI beyond what is needed to verify the endpoint  

## Discovery notes

- **Purpose** drives required amount fields (purchase vs refinance).  
- **Collateral value** requires at least one of **ARV** or **as-is value** on **`property`**.  
- **Rehab budget** defaults to zero when omitted.  
- **Risks** must remain **structured objects**, not string arrays.  
- Legacy clients may send old shapes; behavior is **adapter-only**, not part of the public contract.

## Success criteria

- One documented request/response pair reviewers can sign off.  
- Explicit **400** error codes for failure modes.  
- **`pricing`** and **`cashToClose`** outputs expose a **`status`** so stubs are never mistaken for final underwriting outputs.  
- **`loan`** carries only normalized inputs plus metrics **actually computed** in v1 (no speculative placeholders).

## Sign-off

Scout brief approved for Architect → Builder handoff. Canonical schema version string: **`deal_analyze.v1`**.

**Contract hardening:** follow-up decisions are captured in [`docs/specs/TICKET-001A.md`](../specs/TICKET-001A.md) (narrow addendum; same product scope).
