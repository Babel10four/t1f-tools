# Scout brief — TICKET-009

**Status:** closed  
**Last updated:** 2026-04-15  
**Ticket:** TICKET-009 — Credit Copilot v1  
**Product context:** **Vanguard by TheFoundry** — display name **Credit Copilot**; v1 is **text-first** only.

---

## Problem

Tier-one reps need **nuanced credit-policy guidance** grounded in the **currently published** Credit Policy—not generic model knowledge, not final underwriting decisions, and not borrower-facing compliance copy.

## User / consumer

Authenticated internal reps (and admins) using **`/tools/credit-copilot`** against **`POST /api/credit-copilot/ask`**.

## Objective (v1 slice)

- **Policy-bound Q&A** using **CONTENT-002** resolver: **`tool_key: credit_copilot`**, **`binding_type: credit_policy_document`**.  
- **Grounding** from **pre-extracted** `documents.extracted_text` only — **no** runtime PDF parsing.  
- **Fail closed** when binding or text is unavailable.  
- **No** chat persistence, **no** voice, **no** credit pulls, **no** external data APIs, **no** PII in analytics.

## Out of scope

Borrower-facing surfaces, approval/decline language, voice, saved history (unless explicitly approved later), runtime PDF OCR.

## Success criteria

- Answers cite **published policy** with **version metadata**; cautious copy; **refusal** paths for decision-seeking or sensitive prompts.  
- Analytics log **`credit_copilot_question`** with **safe metadata only**.

## Sign-off

Scout brief approved for Builder. Detailed behavior: [`docs/specs/TICKET-009.md`](../specs/TICKET-009.md).
