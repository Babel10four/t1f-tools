# Policy configuration permission repair — 2026-10-21

## Scope and authorization

Barrett requested: “Go ahead and fix the database permissions issue. Make sure
only authorized admins can change the policy rules, and verify the calculator
still works for the team.”

Target: T1F Tools production Supabase project `xsbbojmvnjiqqpgkncyi`.
Migration: `20261021213043_lock_down_policy_configuration_permissions`, applied
successfully at 2026-10-21 21:30 UTC. Source SQL is
`drizzle/0006_policy_configuration_permissions.sql`.

Only the policy configuration surface changed: `documents`, `rule_sets`, and
`tool_context_bindings`. Business rules, policy versions, bindings, credentials,
and app authentication behavior were not changed.

## Architecture and change

The app uses a server-only Postgres `DATABASE_URL` through Drizzle. It does not
use Supabase Auth or browser-side Supabase table access. Browser sessions are
signed app cookies with `user` or `admin` roles. All 12 rule-set, binding, and
policy-document mutation handlers check the verified `admin` role before any
service, database, storage, or audit call; the proxy is an additional boundary.

Before the repair, all three policy tables were owned by `postgres`, RLS was
disabled, and Supabase `anon`/`authenticated` roles held all table privileges.
There were no public functions, views, or RLS policies to provide an alternate
policy write path. API roles did not inherit privileged roles.

The migration enables RLS with no direct-client policies (intentional deny by
default), and revokes all table privileges from `PUBLIC`, `anon`, and
`authenticated`. Existing `postgres` and trusted `service_role` access remains
unchanged. No new roles, grants, credentials, or SECURITY DEFINER functions were
created. Drizzle schema also records `.enableRLS()` to prevent schema drift.

This closes the direct Data API bypass. Application admins continue editing
through the existing guarded admin routes; reps continue using server-computed
calculator results without table access. Privileged database operators remain
trusted infrastructure administrators, not rep sessions.

## Verification

- Migration first tested on isolated temporary PostgreSQL 16, using the actual
  schema and Supabase-like API roles/grants, with no network listener.
- `scripts/verify-policy-permissions.sql` passed both locally and against live
  production. It checks RLS, absence of permissive policies, all table and column
  privileges, real denied no-op UPDATEs for both API roles on all three tables,
  and successful trusted-operator read/no-op-write probes. It rolls back and
  changes no data.
- Read-back: all three tables have RLS enabled; only existing `postgres` and
  `service_role` table ACL entries remain.
- Before/after full-row fingerprints match exactly:

| Table | Rows | MD5 of ordered complete row JSON |
| --- | ---: | --- |
| documents | 1 | ef3e7b4b5fd9ae9d53886b59a5932357 |
| rule_sets | 2 | 53d71261adc6f429f099ad9b6eef28a1 |
| tool_context_bindings | 3 | 56e8239c61023dfb65853db329999c94 |

- 442 automated tests passed, including all 10 real-database lifecycle tests
  against the isolated database with the permission migration applied.
- 36 new regression tests cover all 12 mutations: rep and anonymous denied
  before service calls, spoofed role inputs ineffective, admin allowed.
- Live rep workspace (`user`, build `dbd9832`) reran Kayla's example after the
  permission change at approximately 21:31 UTC: purchase $517,500, rehab $27,500,
  ARV $680,000, Tier 3, requested $467,375, FICO blank. Result: acquisition
  **$439,875**, rehab **$27,500**, total **$467,375**, initial LTC **85%**, ARV LTV
  **68.73%**. No policy fallback or permission error. Expected indicative /
  incomplete borrower-context notice remains because FICO was not supplied.
- The same live rep session received `Forbidden` on `/api/admin/rule-sets`.
  A signed-out POST to that route returned HTTP **401 Unauthorized**.
- Production build passed, including TypeScript. Initial standalone typecheck
  found duplicate generated `.next/types/* 2.ts` declarations; the normal build
  regenerated the cache successfully. Existing document-storage tracing warning
  remains unrelated to this change.

## Remaining boundaries

- Admin identity is still the existing shared-password admin role, not named
  individual accounts. Sessions remain seven days; credentials/session design
  were not changed. No real admin login credential was retrieved or reset.
  Admin allow-path evidence is automated handler tests plus trusted DB probes,
  not a new production policy edit.
- Four unrelated tables (`events`, `intel_borrower_snapshots`,
  `intel_competitor_snapshots`, `intel_property_dossiers`) still have the
  previously identified RLS-disabled advisory. They were not changed by this
  narrowly scoped policy-permissions repair.
- Supabase default privileges for future tables/functions remain unchanged;
  future migrations must explicitly review grants and RLS before deployment.
- The three “RLS Enabled No Policy” informational notices are expected: these
  tables deliberately have no direct-client access.

Guidance: [Supabase API access controls](https://supabase.com/docs/guides/api/securing-your-api),
[RLS-disabled advisory](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public),
[intentional no-policy notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## Recovery

The migration does not alter any policy data. If a server read fails, verify
the actual server connection role and grant only its required access; do not
restore broad API grants as an automatic workaround. Original ACLs were
`postgres`, `anon`, `authenticated`, and `service_role` with all privileges;
RLS was false and no policies existed. Reverting that security boundary would
reopen the confirmed vulnerability and requires explicit operator approval.
