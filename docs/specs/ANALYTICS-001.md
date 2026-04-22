# BUILD SPEC — ANALYTICS-001

**Status:** approved  
**Last updated:** 2026-04-18  
**Depends on:** [`ACCESS-001`](./ACCESS-001.md), [`ADMIN-001`](./ADMIN-001.md)  
**Parent:** [`PLATFORM-PATH-A.md`](./PLATFORM-PATH-A.md)

---

## Objective

**Usage event logging** and **admin dashboard** so platform behavior is observable from day one — not bolted on later.

---

## Event schema (minimum)

| Field | Notes |
|-------|--------|
| `id` | UUID |
| `event_type` | See list below |
| `tool_key` | e.g. `loan_structuring_assistant`, `pricing_calculator`, `cash_to_close_estimator`, `term_sheet`, `rural`, `credit_copilot`, `deal_analyzer` (see **ANALYTICS-001A**) |
| `role` | `user` \| `admin` (from session) |
| `session_id` | Opaque id from cookie or server session |
| `route` | Path or logical route |
| `created_at` | Timestamp |
| `status` | `success` \| `error` |
| `metadata` | JSON — tool-specific payload (bounded size) |

**Event types (minimum set):**  
`deal_analyze_run`, `term_sheet_generated`, `pricing_check_run`, `cash_to_close_run`, `rural_check_run`, `credit_copilot_question`, `document_uploaded`, `document_published`, `rule_set_updated`.

---

## Instrumentation

- Wrap **every meaningful user/tool action** (server-side preferred for integrity).  
- Store in **Postgres** (or append-only table).

---

## Dashboard KPIs (`/admin/dashboard`)

- Term sheets created  
- Pricing checks run  
- Cash-to-close estimates run  
- Rural addresses checked  
- Document uploads / publishes  
- Tool usage by day/week  
- **Current published** policy/config versions (join **CONTENT-001** / **CONFIG-001**)  
- Error counts by tool  

**Limitation:** Shared passwords → **no** reliable per-named-human attribution (see **PLATFORM-PATH-A**).

---

## ANALYTICS-001A — KPI / taxonomy alignment (v1)

**Problem:** The Term Sheet **preview** tool (TICKET-007) only calls **`POST /api/deal/analyze`** and logs **`deal_analyze_run`** with **`tool_key = term_sheet`**. It does **not** use **`term_sheet_generated`** (that event is reserved for **`POST /api/deal/terms`** or a future true export/generation path).

**Dashboard rules for analyze-backed tools:**

| KPI (UI label) | Count rows where |
|----------------|------------------|
| Loan Structuring Assistant runs | `event_type = deal_analyze_run` AND `tool_key = loan_structuring_assistant` |
| Deal Analyzer runs | `event_type = deal_analyze_run` AND `tool_key = deal_analyzer` |
| Pricing checks | `event_type = pricing_check_run` AND `tool_key = pricing_calculator` |
| Cash-to-close runs | `event_type = cash_to_close_run` AND `tool_key = cash_to_close_estimator` |
| **Term Sheet preview runs** | `event_type = deal_analyze_run` AND `tool_key = term_sheet` |
| Term sheet terms API (reserved) | `event_type = term_sheet_generated` — **not** used for the preview KPI |

**Legacy header aliases:** `X-T1F-Tool-Key: loan_structuring` and `cash_to_close` normalize to **`loan_structuring_assistant`** and **`cash_to_close_estimator`** when persisting. The dashboard **KPI SQL** counts both canonical and legacy **`tool_key`** values for those two tools so older rows remain visible.

---

## Definition of done

- [x] Events persisted; schema stable.  
- [x] Dashboard shows agreed KPIs with real or stubbed joins.  
- [x] Error events captured with `status: error` and safe metadata.  
