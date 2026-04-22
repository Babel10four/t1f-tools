# BUILD SPEC — POLICY-ADOPTION-001

**Status:** closed (audit-verified)  
**Last updated:** 2026-04-18  
**Aligns with:** [`PLATFORM-DATA-001`](./PLATFORM-DATA-001.md) (`rule_sets`, CONTENT-002 resolver)  
**Out of scope:** Public **`POST /api/deal/analyze`** contract changes; PDF parsing; Credit Copilot; Rural Checker; browser policy logic; broad engine rewrite.

**POLICY-ADOPTION-001A (hardening):** **Closed** — see [`POLICY-ADOPTION-001A.md`](./POLICY-ADOPTION-001A.md) (resolver tests, **`POLICY_CONFIG_FALLBACK`** on HTTP, no public shape change).

---

## Objective

Wire the **deal engine** (`runDealAnalyze` and its policy helpers) to **published** `rule_sets` resolved via **CONTENT-002** for:

| `rule_set.kind` | Purpose in v1 |
|-----------------|---------------|
| **`rates`** | Populate **indicative** `pricing.*` scalars where today they are **`null`** for supported paths (subject to pricing-status rules). |
| **`calculator_assumptions`** | Replace **hardcoded** leverage caps, default term, LTV risk threshold, and **cash-to-close line multipliers** used in deterministic line builders. |

**Goal:** Admin changes to published config **change live tool outputs** (Loan Structuring Assistant, Pricing Calculator, Cash to Close Estimator, Term Sheet) **without** changing request/response JSON shapes.

---

## 1. Hardcoded constants to move behind lookup (exact inventory)

**File: `src/lib/engines/deal/policy/constants.ts`**

- `POLICY_MAX_LTC_PCT`  
- `POLICY_MAX_ARV_LTV_PCT`  
- `POLICY_REFINANCE_MAX_LTV_PCT`  
- `POLICY_DEFAULT_TERM_MONTHS` *(if still referenced for anything user-visible)*  
- `POLICY_LTV_OVER_LIMIT_THRESHOLD_PCT`  

**Files: `src/lib/engines/deal/policy/purchaseMax.ts`, `refinanceMax.ts`, `recommendedAmount.ts`, `risks.ts`**

- Consume caps/thresholds via **injected snapshot** (see §3), not direct imports of mutable globals, so tests can freeze values.

**File: `src/lib/engines/deal/policy/cashToCloseLines.ts`**

- Hardcoded **multipliers** (today): `0.005` (points), `0.01` (lender fees), `0.015` (closing costs) for both purchase and refinance paths.  
- **Labels/order** stay **frozen in code** for v1 (same strings as `deal-engine-v1-assumptions.md`) — **not** CMS-driven in this ticket unless CONFIG explicitly versions label strings (defer).

**File: `src/lib/engines/deal/analyze.ts`**

- **`pricing`:** `noteRatePercent`, `marginBps`, `discountPoints`, `lockDays` currently **`null`** for supported products — populate from **`rates`** payload when present.  
- **Orchestration:** thread `PolicySnapshot` into `pricingStatusForSupportedDeal`, `cashToCloseLinesForPurpose`, policy max/risk helpers as needed.

**Do not move in v1 (unless CONFIG expands scope explicitly):**

- Request/response types, validation, legacy normalization.  
- Risk **codes** / **titles** / **detail templates** (wording) — only numeric thresholds that already reference `POLICY_*` constants.  
- Exact cash-to-close **label strings** (keep deterministic).

---

## 2. Resolver usage (server-only)

**Where to resolve**

- **Preferred:** Single call in **`handleDealAnalyzePost`** (after validation, before `runDealAnalyze`) **or** first line inside `runDealAnalyze` via a **`resolveDealAnalyzePolicy()`** helper that internally calls the **CONTENT-002** resolver for **`tool_key = deal_engine`** (shared engine policy, not UI tool keys).

**What the resolver returns (logical shape)**

```ts
type DealAnalyzePolicySnapshot = {
  source: "published" | "fallback";
  rates: {
    noteRatePercent: number | null;
    marginBps: number | null;
    discountPoints: number | null;
    lockDays: number | null;
  } | null;
  calculator: {
    maxLtcPct: number;
    maxArvLtvPct: number;
    refinanceMaxLtvPct: number;
    ltvOverLimitThresholdPct: number;
    /** Cash-to-close illustrative multipliers (same semantics as current hardcoded). */
    ctcPointsPct: number;
    ctcLenderFeesPct: number;
    ctcClosingCostsPct: number;
  };
};
```

- **`rates`** may be **partial** — apply **per-field** nulls as today.  
- **`calculator`** must be **complete** for a successful publish path; if incomplete, use **full fallback** (§4).

**No** client-side resolver; **no** reading PDFs at runtime.

---

## 3. Config-to-engine mapping

| Config slice | Engine consumer |
|--------------|-----------------|
| `calculator.maxLtcPct` etc. | `purchasePolicyBreakdown` / `purchaseMax` math, `refinancePolicyMax`, `recommendedLoanAmount` bounds, `POLICY_LTV_OVER_LIMIT` style checks |
| `calculator.ctc*Pct` | `buildCashToCloseLinesPurchase` / `buildCashToCloseLinesRefinance` (replace `0.005` / `0.01` / `0.015`) |
| `rates.*` | `analyze.ts` → `pricing` object for supported paths; **`pricing.status`** logic unchanged except where today nulls force `indicative` — document in implementation |

**Binding keys (recommendation — freeze in CONFIG):**

- `rule_set.kind = calculator_assumptions` → binding_type **`calculator_assumptions_rule_set`** for `tool_key = deal_engine`  
- `rule_set.kind = rates` → binding_type **`rates_rule_set`** for `tool_key = deal_engine` — POLICY-ADOPTION-001 consumes **CONTENT-002** outputs only (two bindings; optional `rates` pricing fields on the `rates` JSON payload).

---

## 4. Fallback rules (when bindings/config missing)

1. **`source: "fallback"`** — Resolver returns no published payload, DB error, or payload fails schema validation.  
2. **Behavior:** Use **today’s** numeric values **exactly** as currently implemented in `policy/constants.ts` and `cashToCloseLines.ts` multipliers (byte-for-byte same outputs as pre-adoption for identical requests).  
3. **`analysis.flags` entry `POLICY_CONFIG_FALLBACK`** (non-blocking, `info`) when embedded defaults are used on the **HTTP** analyze path — see POLICY-ADOPTION-001A.  
4. **Never** return **400** solely because config is missing — analyze must remain **200** when request validates.

---

## 5. Config-driven in v1 (narrow)

| Area | Config-driven? |
|------|----------------|
| Policy caps (LTC / ARV LTV / refi LTV / LTV threshold) | **Yes** |
| Cash-to-close **amount** multipliers | **Yes** |
| Cash-to-close **labels / order** | **No** (stay code + docs) |
| **Pricing** numeric fields | **Yes** (when `rates` published) |
| **Pricing status** enum semantics | **No** (frozen enums) |
| Risk **copy** strings | **No** (except numeric substitution in existing templates) |

---

## 6. Affected modules (expected touch list)

| Module | Change |
|--------|--------|
| `src/lib/engines/http.ts` or `src/lib/engines/deal/analyze.ts` | Resolve policy snapshot; pass into `runDealAnalyze` |
| `src/lib/engines/deal/policy/constants.ts` | Remain as **fallback defaults**; or re-export `getFallbackSnapshot()` |
| `src/lib/engines/deal/policy/purchaseMax.ts`, `refinanceMax.ts`, `risks.ts` | Accept snapshot or explicit numbers |
| `src/lib/engines/deal/policy/cashToCloseLines.ts` | Accept multiplier params from snapshot |
| `src/lib/engines/deal/analyze.ts` | Apply `rates` to `pricing`; thread snapshot |
| NEW: `src/lib/engines/deal/policy/resolvePolicySnapshot.ts` (or under `src/lib/config/`) | Thin wrapper around CONTENT-002 client API |
| Tests: `deal-analyze.golden-fixtures.test.ts`, `deal-analyze.contract.test.ts`, policy unit tests | Mock resolver or inject snapshot |

**Dependencies:** CONTENT-001/CONFIG-001/CONTENT-002 deliver **storage + resolver**; POLICY-ADOPTION-001 **blocks** on a **callable** server-side resolver in dev/staging.

---

## 7. Test plan

1. **Determinism:** With **fallback** snapshot, outputs match **current** golden/contract baselines (no numeric drift).  
2. **Published override:** With mocked resolver returning **known** non-default caps and multipliers, `loan.amount`, `cashToClose.items`, and `pricing` numerics change **predictably**; request/response **shapes** unchanged.  
3. **Partial rates:** Some `rates` fields `null` — response still validates; missing fields stay `null`.  
4. **Missing config:** Resolver throws or returns empty — engine uses fallback; still **200** for valid analyze requests.  
5. **No regression:** `validateDealAnalyzeRequestV1`, legacy normalization, TICKET-001A error envelopes unchanged.

---

## 8. Definition of done

- [x] **Published** `rates` and `calculator_assumptions` drive **pricing numerics** and **policy/cash math** as above.  
- [x] **Fallback** matches pre-adoption behavior for identical inputs.  
- [x] **`POST /api/deal/analyze`** request/response **types and JSON shape** unchanged.  
- [x] **No** PDF parsing, **no** browser policy, **no** Rural/Credit scope.  
- [x] Resolver uses **CONTENT-002** outputs only (no parallel config source).  
- [x] Tests updated; **deterministic** suites **green** with snapshot injection/mocks.  
- [x] `docs/business-rules/deal-engine-v1-assumptions.md` updated or cross-linked to CONFIG **versioning** (which values are now admin-controlled).

---

## 9. Non-goals

Vector search, full CMS, compliance workflow, per-user pricing, changing `cashToClose` **labels**, rewriting `runDealAnalyze` structure beyond threading a snapshot.

---

## Closure

**Closed:** 2026-04-18 — **audit-verified**. Deal engine consumes **published** `rule_sets` via **CONTENT-002** bindings for **`deal_engine`**; fallback matches pre-adoption numerics; **001A** adds resolver coverage and **`POLICY_CONFIG_FALLBACK`** visibility without changing the public analyze contract.

**Related:** [`POLICY-ADOPTION-001A.md`](./POLICY-ADOPTION-001A.md) (closed).
