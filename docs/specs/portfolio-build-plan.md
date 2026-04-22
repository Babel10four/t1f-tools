# Build plan at the portfolio level

**Status:** roadmap  
**Last updated:** 2026-04-15  

This document is the portfolio-level sequencing for **t1f-tools**: engines, phased delivery, and rationale. Business knowledge (pricing, rural rules, term-sheet examples, voice scenarios, etc.) lives in `docs/business-rules/`. Material changes to engine boundaries or phase order belong in `docs/decisions/`.

---

## Engine map

| Engine | Tools it powers | Build order |
|--------|-------------------|-------------|
| **Deal Engine** | Loan Structuring Assistant, Pricing Calculator, Cash to Close Estimator, Term Sheet Generator, Pricing Comparison Tool | 1 |
| **Property Engine** | Rural Checker, Market Analyzer, Valuation Bot | 2 |
| **Intelligence Engine** | Prospect Researcher, Market Researcher, Credit Copilot | 3 |
| **Interaction Engine** | Interactive Voice Agent | 4 |

Roadmap phases below follow this engine order after the platform spine.

---

## Phase 0 — Platform spine

Build once: shared infrastructure for every tool.

**Ship:**

- Repo structure (`src/app`, `src/components`, `src/lib`, `src/types`, `docs/`, `prompts/`)
- Deploy pipeline
- Env handling
- Shared validation / types
- Logging
- Tool shell UI
- Prompt / spec docs (`prompts/`, `docs/specs/`, etc.)
- Feedback / error capture

**Exit condition:** One placeholder tool accepts input, hits an API route, and returns output in a **production** environment.

---

## Phase 1 — Deal Engine

**Ship (in this order):**

1. Loan Structuring Assistant  
2. Pricing Calculator  
3. Cash to Close Estimator  
4. Term Sheet Generator  
5. Pricing Comparison Tool  

**Why first:** Highest revenue leverage; one rule system across five surfaces.

---

## Phase 2 — Property Engine

**Ship:**

1. Rural Checker  
2. Market Analyzer  
3. Valuation Bot v1  

**Why second:** Underwriting filters and qualification aids that support the Deal Engine.

---

## Phase 3 — Intelligence Engine

**Ship:**

1. Prospect Researcher  
2. Market Researcher  
3. Credit Copilot v1  

**Why third:** Valuable, but depends on a stable entity model and tool shell.

---

## Phase 4 — Interaction Engine

**Ship:**

1. Interactive Voice Agent prototype  
2. Scenario library (voice training; canonical content in `docs/business-rules/`)  
3. Call scoring / coaching rubric  

**Why last:** Highest integration complexity; least necessary for proving initial platform value.

---

## Phase 5 — Access control and polish

**Later:**

- Auth  
- Saved sessions  
- Analytics  
- Usage permissions  
- Audit trail  

---

## Doc map (quick reference)

| Topic | Location |
|-------|----------|
| First sprints (0–3), tickets, Auditor exits | `docs/specs/first-sprints.md` |
| Four Cursor agents (roles, artifacts, boundaries) | `docs/specs/cursor-four-agents.md` |
| Pricing matrix, leverage rules, term sheets, rural rules, credit heuristics, borrower profiles, voice scenario library | `docs/business-rules/` |
| Scout discovery briefs | `docs/briefs/` |
| Architect specs (including this file) | `docs/specs/` |
| Auditor outputs | `docs/audits/` |
| Engine splits, dependency adds, rule-change rationale | `docs/decisions/` |
