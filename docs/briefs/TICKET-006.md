# Scout brief — TICKET-006

**Status:** approved  
**Last updated:** 2026-04-17  
**Ticket:** TICKET-006 — Tool Hub / Navigation Refactor

---

## Problem

The app still reads like a **Create Next App** starter: generic home page, template metadata, and a flat tools link list. Tier-one reps need a **credible internal tool hub** that foregrounds **live Bridge deal workflows**, separates **shipped** tools from **coming soon**, and keeps **advanced** (JSON harness) discoverable but secondary—without pretending every route is equally “productized.”

## User / consumer

Internal reps landing cold on **t1f.tools** who need one obvious **start here** path and honest labels for what works today vs later.

## Objective (v1 slice)

- **`/tools`** becomes the **primary hub** page (content + discovery).  
- **`/`** redirects to **`/tools`**.  
- **Shell + navigation** reflect the frozen **IA**: Tool Hub, Live Tools, Advanced, Coming Soon—**not** legacy stub routes in primary nav, **not** `/tools/pricing` as a primary destination.  
- Replace template branding with **T1F Tools** + internal hub subtitle.  
- **No** engine, API, auth, persistence, or per-tool feature work.

## Out of scope

- Individual tool page logic beyond nav/discovery/metadata necessary for the shell  
- Design-system spike, visual polish ticket  
- Removing route files for “simplicity”  

## Success criteria

- Reps can answer “where do I start?” from **`/tools`** in one glance.  
- Live vs coming soon vs advanced is **obvious** from structure and copy.  
- **`/tools/deal-analyzer`** remains available; **`/tools/pricing`** stays route-valid but **not** in primary hub/nav.  
- All listed live tool URLs still resolve.

## Sign-off

Scout brief approved for Builder. Detailed behavior: [`docs/specs/TICKET-006.md`](../specs/TICKET-006.md).
