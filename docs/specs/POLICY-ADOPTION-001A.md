# BUILD SPEC ADDENDUM — POLICY-ADOPTION-001A (resolver hardening & fallback visibility)

**Status:** closed (audit-verified)  
**Last updated:** 2026-04-18  
**Parent:** [`POLICY-ADOPTION-001`](./POLICY-ADOPTION-001.md) — same product scope; **hardening only** (tests + visible fallback signaling on HTTP).

---

## Objective

Close gaps identified after initial POLICY-ADOPTION-001 implementation:

- Dedicated **`resolveDealAnalyzePolicy`** / resolver-path tests (mocked `resolveToolBinding` where appropriate).  
- **Visible, non-blocking** signal when embedded default policy is used on **`POST /api/deal/analyze`**: **`analysis.flags`** entry **`POLICY_CONFIG_FALLBACK`** (`severity: info`).  
- **No new top-level response keys**; public **`POST /api/deal/analyze`** contract unchanged.  
- Direct **`runDealAnalyze`** calls omit the flag unless **`includePolicyConfigFallbackFlag: true`** (internal/test use).

**Implementation references:** `src/lib/engines/deal/policy/resolvePolicySnapshot.test.ts`, `policy-adoption.test.ts`, `analyze.ts` (`policyConfigFallbackAnalysisFlag`).

---

## Audit closure (verified)

Latest audit confirms:

| Scenario | Expected behavior (verified) |
|----------|-----------------------------|
| Invalid calculator config | Falls back to embedded defaults |
| Valid calculator + invalid/missing rates | Behaves correctly (calculator drives caps; rates partial/null as designed) |
| Resolver throw | Falls back; analyze remains **200** when request validates |
| HTTP path | Adds **`POLICY_CONFIG_FALLBACK`** in **`analysis.flags`** when fallback used |
| Contract | **No** change to public response **shape** |

---

## Definition of done

- [x] Resolver tests cover failure and fallback paths.  
- [x] **`POLICY_CONFIG_FALLBACK`** visible on HTTP when defaults used.  
- [x] No public shape regression.  

---

## Closure

**Closed:** 2026-04-18 — **audit-verified**; parent **POLICY-ADOPTION-001** remains the primary BUILD SPEC; this addendum records **001A** hardening only.
