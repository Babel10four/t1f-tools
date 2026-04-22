# Platform Path A — locked architecture & delivery order

**Status:** approved (founder / Architect lock)  
**Last updated:** 2026-04-18  
**Context:** **[`TICKET-007`](./TICKET-007.md) (Term Sheet Generator) is complete.** Path A proceeds: **finish tool work already in motion**, then **immediately** build platform foundation tickets in parallel or sequence below.

This document is the **project-level decision summary** and **ticket order** for the next phase. Child specs: **`ACCESS-001`**, **`ADMIN-001`**, **`CONTENT-001`**, **`CONFIG-001`**, **`ANALYTICS-001`**, **`CONTENT-002`**.

---

## Locked decisions (non-negotiable)

| Decision | Rule |
|----------|------|
| **Auth model** | **App-level auth** — **do not** use **Vercel deployment password protection** as the primary security model. |
| **Passwords** | **Two shared passwords** mapped to **two roles**: `user` and `admin`. **Admin is a superset** of user (everything a base user can do, plus admin-only areas). |
| **Login UX** | **One** login page, **one** password field. Backend compares submitted password to **`SITE_PASSWORD_USER_HASH`** and **`SITE_PASSWORD_ADMIN_HASH`** (env), then sets a **signed httpOnly cookie** with `role=user` or `role=admin`. |
| **Concurrency** | Shared passwords intentionally allow **multiple simultaneous sessions** per password; **no** per-human identity until named accounts exist. |
| **Documents vs runtime** | **PDFs** = source-of-truth **documents** (credit policy, rural reference, Q&A corpora). **Structured config** = source-of-truth for **rates, fees, calculator inputs, publishable numeric tables**. **Calculators must not depend on raw PDF retrieval at runtime** — use **publish → structured snapshot → tools read published config**. |
| **Publish workflow** | **Upload → parse/extract → admin review → publish** → versioned structured rule/config; tools consume **published**, not merely **latest upload**. |
| **Analytics** | **Event logging is platform infrastructure**, not a post-launch add-on. |
| **Storage truth** | **Postgres** (metadata, events, configs) + **object storage** (PDFs). **Not** Airtable as SoT for PDF versioning, publish state, events, or runtime policy resolution. (Airtable OK for loose planning only.) |
| **Research / voice / disclosures** | **Post-launch** priority per product grouping below. |

---

## Architecture overview

### A. Auth / roles

| Audience | Routes |
|----------|--------|
| **Public** | `/login` |
| **Authenticated (user or admin)** | `/tools`, **`/tools/**`** (all live tools) |
| **Admin only** | `/admin`, `/admin/dashboard`, `/admin/documents`, `/admin/rules`, `/admin/publish-history`, uploads, config, analytics |

**Middleware:** `/tools/**` → requires `user` **or** `admin`; `/admin/**` → requires `admin`; **admin-only mutation APIs** → `admin` only.

### B. Content / rules (core infrastructure)

- **`documents`** — uploaded PDFs, extraction, versioning, draft / published / archived.  
- **`rule_sets`** — v1 kinds are **frozen** in **[`CONFIG-001`](./CONFIG-001.md):** `rates`, `calculator_assumptions`, `rural_rules` — not a generic CMS; optional `source_document_id`, publish lifecycle.  
- **`tool_bindings`** (per **CONTENT-002**) — v1 **`binding_type`** values (`credit_policy_document`, `rural_policy_document`, `rates_rule_set`, `calculator_assumptions_rule_set`, `rural_rules_rule_set`); **published-only** resolution **server-side**; bindings are sole authority.  

**Workflow:** Admin uploads → classify → extract → review → **publish** → tools switch; **rollback** supported.

### C. Analytics / events

Instrument **every meaningful tool action**. Minimum event types include: `deal_analyze_run`, `term_sheet_generated`, `pricing_check_run`, `cash_to_close_run`, `rural_check_run`, `credit_copilot_question`, `document_uploaded`, `document_published`, `rule_set_updated`.

**Fields:** `id`, `event_type`, `tool_key`, `role` (user/admin), `session_id`, `route`, `created_at`, `status` (success/error), `metadata` JSON.

**Caveat:** With shared passwords, analytics give **counts, sessions, timestamps, role** — **not** reliable per-named-human attribution until named accounts exist.

---

## Product grouping (hub / nav)

### Deal Workbench (primary)

Loan Structuring Assistant · Pricing Calculator · Cash to Close Estimator · Term Sheet Generator · Pricing Comparison Tool · Rural Checker · **AI Copilot** (umbrella as needed)

**Loan Structuring Assistant** stays in **Deal Workbench**, not under “AI robots” — it is a **workflow tool** for reps.

### Advanced

Deal Analyzer (JSON harness)

### Later (post-launch)

Market Researcher · Prospect Researcher · Interactive Voice Agent · Disclosure Generator

### Admin-only nav (admin sees **full base nav +**)

Admin Dashboard · Documents · Rule Sets & Rates · Publish History

---

## Recommended admin information architecture

**Base user:** Tool Hub + Deal Workbench tools + Deal Analyzer (advanced) as currently designed.

**Admin:** Same **plus** Admin Dashboard, Documents, Rule Sets & Rates, Publish History.

---

## Path A — execution order (locked)

**TICKET-007** — **Complete** (Term Sheet Generator).

**Then immediately (launch-critical, equal tier):**

1. **[`ACCESS-001`](./ACCESS-001.md)** — Shared-password auth, user/admin roles, cookie, middleware.  
2. **[`ADMIN-001`](./ADMIN-001.md)** — Admin shell + protected `/admin/**` routes.  
3. **[`CONTENT-001`](./CONTENT-001.md)** — Document library, PDF upload, publish/rollback.  
4. **[`CONFIG-001`](./CONFIG-001.md)** — Structured rule sets & rates, publish, latest-published resolution.  
5. **[`ANALYTICS-001`](./ANALYTICS-001.md)** — Event logging + admin dashboard KPIs.  
6. **[`CONTENT-002`](./CONTENT-002.md)** — Server-side **tool bindings** resolver (published-only; v1 binding types; explicit missing state; no live-tool rewrite in scope).  

**Credit Copilot** should **wait** until **`CONTENT-001`** (and preferably **`CONTENT-002`**) exist, so answers can use **published** credit-policy documents and structured snapshots — not volatile PDF pulls.

---

## Storage (practical)

- **Vercel** — app hosting.  
- **Postgres** — documents metadata, rule_sets, events, tool_bindings.  
- **Object storage** — PDF blobs (e.g. **Supabase** Postgres + Storage, or **Neon** + **S3** / **Vercel Blob**).  
- **Vector index** — optional later for policy Q&A.

---

## Related specs

| Ticket | Doc |
|--------|-----|
| ACCESS-001 | [`ACCESS-001.md`](./ACCESS-001.md) |
| ADMIN-001 | [`ADMIN-001.md`](./ADMIN-001.md) |
| CONTENT-001 | [`CONTENT-001.md`](./CONTENT-001.md) |
| CONFIG-001 | [`CONFIG-001.md`](./CONFIG-001.md) |
| ANALYTICS-001 | [`ANALYTICS-001.md`](./ANALYTICS-001.md) |
| CONTENT-002 | [`CONTENT-002.md`](./CONTENT-002.md) |
