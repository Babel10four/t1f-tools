# TECH-001 — const/type cleanup

**Status:** open  
**Last updated:** 2026-04-16  
**Context:** Follow-up to closed [`TICKET-001`](./TICKET-001.md) / [`TICKET-001A`](./TICKET-001A.md).

---

## Objective

Reduce duplication and tighten typing around the deal-analyze contract without changing runtime behavior.

## Scope

- **Dedupe `deal_analyze.v1`:** consolidate string literals with `DEAL_ANALYZE_SCHEMA_VERSION` / `src/lib/engines/deal/schemas/deal-analyze-constants.ts` (and any other canonical sources) so the version string has a single source of truth.
- **Optional:** introduce a shared HTTP error-code type that includes **`AMBIGUOUS_INPUT_SHAPE`** (and other deal-analyze **400** codes) so `http.ts`, validators, and tests stay aligned.

## Out of scope

- Contract or validation behavior changes; this ticket is DRY and typing only.
