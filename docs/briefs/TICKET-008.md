# Scout brief — TICKET-008

**Status:** closed — Rural Checker v1 shipped  
**Last updated:** 2026-04-16  
**Ticket:** TICKET-008 — Rural Checker v1

**Spec:** [`docs/specs/TICKET-008.md`](../specs/TICKET-008.md) (closed). **Policy seed / audit:** [`docs/specs/RURAL-DATA-001.md`](../specs/RURAL-DATA-001.md) (implemented; audit pending).

---

## Problem

Reps need a **fast, deterministic rural-eligibility screen** aligned to **governed** rural rules and policy metadata—not a legal determination, not geocoding, and not a full Property Engine.

## User / consumer

Internal reps screening Bridge collateral; admins publish **`rural_rules`** and optional **`rural_policy`** documents via CONTENT/CONFIG.

## Objective (v1 slice)

- **Route:** **`/tools/rural-checker`** — form + results.  
- **API:** **`POST /api/property/rural`** — evaluate against **published** `rural_rules` via **CONTENT-002** (`tool_key: rural_checker`, `binding_type: rural_rules_rule_set`); optional **`rural_policy_document`** metadata only.  
- **No** changes to **`/api/deal/analyze`**, **no** deal engine changes, **no** runtime PDF parsing, **no** persistence, **no** broad Property Engine. **Exception:** session-gating **`/api/property/**`** via middleware matcher (or tiny patch) if Builder confirms it is currently uncovered — see spec **§ Frozen decisions**.

## Out of scope

External APIs, geocoding (unless later ticket), PDF text at runtime, compliance sign-off language.

## Success criteria

- Deterministic **result** + **reasons** + **warnings** from structured rules + user inputs.  
- **Published-only** config via resolver; honest **fallback** when missing.  
- Analytics: **`rural_check_run`**.

## Sign-off

**TICKET-008** closed 2026-04-16. Detailed behavior and closure: [`docs/specs/TICKET-008.md`](../specs/TICKET-008.md).
