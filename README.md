This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Authentication (ACCESS-001 / ACCESS-001A)

App-level **shared-password** roles (`user`, `admin`) — no named accounts or user database.

| Variable | Purpose |
|----------|---------|
| `AUTH_SECRET` | HMAC key for signed **httpOnly** session cookie (JWT). **Minimum 32 characters.** |
| `SITE_PASSWORD_USER_HASH` | Bcrypt hash of the base **user** password. |
| `SITE_PASSWORD_ADMIN_HASH` | Bcrypt hash of the **admin** password (superset of user access). |

The JWT payload is minimal: **`role`** (`user` \| `admin`) and opaque **`sid`** (session id for analytics; not a named identity).

Copy [`.env.example`](./.env.example) to `.env.local` and set values. Generate hashes:

```bash
node -e "const b=require('bcryptjs');b.hash('your-password',10).then(console.log)"
```

Generate a strong signing secret:

```bash
openssl rand -base64 32
```

- **`/login`** — single password field; failures return a **generic** error (no hint which hash failed). Successful logins return a server-chosen default path (`/tools` for user, `/admin/dashboard` for admin) unless a safe `next` query param is present.
- **`/logout`** — clears the session cookie and sends you to `/login`.
- **Middleware (ACCESS-001A)** enforces:
  - **`/tools/**`** — requires `user` or `admin` (unauthenticated → redirect `/login`).
  - **`/admin/**`** — `admin` only (`user` → redirect `/tools`).
  - **`/api/deal/**`** — `user` or `admin` (unauthenticated → **401** JSON).
  - **`/api/property/**`** — `user` or `admin` (unauthenticated → **401** JSON); Rural Checker API (`POST /api/property/rural`).
  - **`/api/credit-copilot/**`** — `user` or `admin` (unauthenticated → **401** JSON); Credit Copilot API (`POST /api/credit-copilot/ask` — see [`docs/specs/TICKET-009.md`](./docs/specs/TICKET-009.md)).
  - **`/api/admin/**`** — `admin` only (`user` → **403** JSON).
  - **`/login`** — authenticated users are redirected (`user` → `/tools`, `admin` → `/admin/dashboard`).
  - Other routes (e.g. `/api/intel/**`) are **not** gated unless you extend `src/middleware.ts` `matcher`.
- **`/api/auth/login`** and **`/api/auth/logout`** stay outside the gate for bootstrapping sessions.

## Admin document library (CONTENT-001)

PDF metadata lives in **Postgres**; file bytes in **Vercel Blob** (private) when `BLOB_READ_WRITE_TOKEN` is set, otherwise **local** `.local-documents/` for development.

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres connection string. **Required in production** for `/admin/documents`, published **`rural_rules`** (Rural Checker), **`rule_sets`**, and the **`events`** analytics table (admin dashboard KPIs). Without it, those features return configuration errors. |

### Production (e.g. Vercel)

1. Create a Postgres instance (Neon, Supabase, RDS, etc.) and copy its connection string.
2. In the host’s environment settings, set **`DATABASE_URL`** for **Production** (and **Preview** if you want branch deploys to work the same).
3. Apply schema: from your machine run `npm run db:push` with `DATABASE_URL` set to that URL, or run `drizzle/0001_documents.sql` → `0002_rule_sets.sql` → `0003_events.sql` in order against the database.
4. Redeploy the app. Seed or publish **`rural_rules`** and bindings if Rural Checker should score beyond `insufficient_info` (see `npm run data:rural-001` / admin Rules UI).
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob read/write token for private PDF storage (production). |
| `LOCAL_DOCUMENT_ROOT` | Optional; overrides the local dev directory for PDFs when Blob is not configured. |

Apply schema:

```bash
# With DATABASE_URL set — sync Drizzle schema (or run drizzle/0001_documents.sql with psql)
npm run db:push
```

**Publish / rollback (explicit, no hard deletes):**

- **Publish** — only from **`draft`**. Any other **`published`** row in the same **`series_id`** is set to **`archived`** (with `archived_at`). The draft becomes **`published`** with `published_at` set.
- **Rollback** — only from **`archived`**. Reactivates that row as **`published`** and archives the current **`published`** row in the same series (swap).
- **Archive** — **`draft`** or **`published`** → **`archived`** (reversible history; rows retained).

**`extracted_text`** — best-effort text via `pdf-parse` (text-based PDFs); failures leave the field empty; upload still succeeds.

**`tool_context_bindings`** — not created in this ticket (CONTENT-002).

## Rule sets & runtime configuration (CONFIG-001 / CONFIG-001A)

Structured **runtime** settings (rates tables, calculator assumptions, rural rules) live in Postgres as **`rule_sets`**, separate from PDF documents. Tools will read published rule sets in **CONTENT-002**; CONFIG-001 only adds admin CRUD and lifecycle.

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Same Postgres as documents — **`rule_sets` requires `documents` for optional `source_document_id` FK.** |
| `RULE_SETS_INTEGRATION_DATABASE_URL` | **Optional.** When set, Vitest runs [DB-backed lifecycle tests](src/lib/rule-sets/service.lifecycle.integration.test.ts) against that URL (CI uses this). Does not replace `DATABASE_URL` for the app. |

**Schema / migration**

- SQL migrations: `drizzle/0001_documents.sql` (prerequisite), then `drizzle/0002_rule_sets.sql` (partial unique index: **one `published` row per `rule_type`**), then `drizzle/0003_events.sql` (analytics — can ship after rule sets).
- Or sync from Drizzle schema: `npm run db:push` with `DATABASE_URL` set (same as CONTENT-001).

**Admin UI — `/admin/rules`**

- Admin-only (same session as other admin surfaces).
- Create **draft** rule sets with JSON payloads validated per type, then **Publish** or **Rollback** / **Archive** as needed.
- Optional **`source_document_id`** links a rule set to a row in **`documents`** (provenance), not PDF bytes at runtime.

**v1 `rule_type` values (frozen)**

| `rule_type` | Purpose |
|-------------|---------|
| `rates` | Versioned rate tables / indices for pricing-related tools. |
| `calculator_assumptions` | Numeric caps and inputs for deal/workflow calculators. |
| `rural_rules` | Structured rural eligibility / scoring rules (separate from rural policy PDFs). |

**Publish / rollback (practical semantics)**

- **Publish** — only from **`draft`**. All rows that are **`published`** for the **same `rule_type`** are moved to **`archived`** (timestamped). The draft becomes **`published`** with `published_at` set. This is **not** “latest upload wins”: publishing is explicit, and at most one published row per `rule_type` is enforced in the DB.
- **Rollback** — only from **`archived`**. The current **`published`** row for that `rule_type` is archived; the chosen archived row becomes **`published`** again (non-destructive history).
- **Archive** — a **`draft`** or **`published`** row can be archived without deleting data.

**Verifying lifecycle in CI**

- GitHub Actions workflow `.github/workflows/test.yml` (at the **repository root** next to `package.json`) starts Postgres, sets `RULE_SETS_INTEGRATION_DATABASE_URL`, and runs the full test suite so integration tests execute against a real database. If the app lives in a monorepo subfolder, move or adapt that workflow and set `defaults.run.working-directory` accordingly.

## Analytics & admin KPIs (ANALYTICS-001 / ANALYTICS-001A)

Append-only **`events`** rows in Postgres (`drizzle/0003_events.sql` or `npm run db:push`) power **`/admin/dashboard`**.

| Field | Source |
|-------|--------|
| `role` | JWT **`role`** (`user` \| `admin`) when present |
| `session_id` | JWT opaque **`sid`** (same value as analytics “session”) |
| `event_type` | Explicit taxonomy — see `src/lib/analytics/constants.ts` |

**`POST /api/deal/analyze`** — request **body is unchanged**. Clients send optional header **`X-T1F-Tool-Key`** with canonical values such as **`loan_structuring_assistant`**, **`pricing_calculator`**, **`cash_to_close_estimator`**, **`term_sheet`**, **`deal_analyzer`**. The server stores a **`tool_key`** on each event; **dashboard tool KPIs count `event_type` + `tool_key` together** (e.g. Term Sheet **preview** runs = `deal_analyze_run` + `tool_key = term_sheet`, not the whole analyze stream). **`term_sheet_generated`** is still emitted by **`POST /api/deal/terms`** and is **reserved** for a future true generation/export KPI — it does **not** feed the Term Sheet preview card.

**Failure behavior:** event inserts run in a **`try/catch`**; failures are **silent** (tools and admin flows are not blocked). If **`DATABASE_URL`** is missing or the **`events`** table is not migrated, the dashboard shows a short notice instead of KPI numbers.

**Other instrumented routes (server-side):** `POST /api/deal/terms`, `POST /api/deal/structure`, `POST /api/property/rural`, `POST /api/voice/session`, admin document upload/publish, rule-set publish/rollback.

**Semantics reference:** `docs/specs/ANALYTICS-001.md` (§ ANALYTICS-001A), `src/lib/analytics/kpi-semantics.ts`.

## Tool context bindings (CONTENT-002)

**`tool_context_bindings`** (`drizzle/0004_tool_context_bindings.sql` or `npm run db:push`) maps **`tool_key` + `binding_type`** to a **published** document or rule set. At most one **published** row per pair; publish supersedes the prior binding (archives it, sets `superseded_by_binding_id`). Resolver: `src/lib/bindings/resolve.ts` — **no** “latest upload” / **no** `ORDER BY created_at` for authority.

- **Admin UI:** `/admin/bindings` (create draft, publish, archive).
- **Admin API:** `GET/POST /api/admin/tool-bindings`, `POST .../[id]/publish`, `POST .../[id]/archive`, `GET /api/admin/tool-bindings/resolve?tool_key=...&binding_type=...` (inspect resolution).

**Spec:** `docs/specs/CONTENT-002.md`, `docs/specs/PLATFORM-DATA-001.md`.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
