# BUILD SPEC — TICKET-002

**Status:** closed (completed 2026-04-17)  
**Last updated:** 2026-04-17  
**Depends on:** closed [`TICKET-001`](./TICKET-001.md), [`TICKET-001A`](./TICKET-001A.md)  
**Scout brief:** [`docs/briefs/TICKET-002.md`](../briefs/TICKET-002.md)  
**Business rules (authoritative for labels + risk codes + provisional caps):** [`docs/business-rules/deal-engine-v1-assumptions.md`](../business-rules/deal-engine-v1-assumptions.md)  
**LTV units note:** [`DOC-001`](./DOC-001.md) (document/test only; no math change there)  
**LTC addendum:** [`TICKET-002A`](./TICKET-002A.md) — LTC observability, **`LTC_OVER_LIMIT`**, purchase limiting-factor **flags** (conditional audit closure)  
**Rep-facing UI:** [`loan-structuring-assistant-ui.md`](./loan-structuring-assistant-ui.md) — frozen route, inputs, layout, state machine (Architect)

---

## Pre-Builder locks (founder)

These are **non-negotiable** for implementation; details live in **`DealAnalyzeLoanOutV1`**, **`deal-engine-v1-enums.ts`**, **`policy/recommendedAmount.ts`**, and [`deal-engine-v1-assumptions.md`](../business-rules/deal-engine-v1-assumptions.md).

1. **`loan.amount` (keep the name)** — Policy-backed **recommended** amount lives in **`loan.amount`**. Do **not** rename to `recommendedAmount` (avoid contract churn). Document semantics instead. The field is an **explicit nested extension** on **`loan`**, not a silent side channel.
2. **Frozen vocabulary** — **`deal.productType`**: only `bridge_purchase` / `bridge_refinance` for supported v1 paths (exact strings). **`pricing.status` / `cashToClose.status`**: union in **`deal-engine-v1-enums.ts`**. **`risks[].code`**: stable set in enums + business-rules. **`loan.ltv`**: **0–100 percent**, never a 0–1 ratio.
3. **Unsupported products** — **HTTP 200** + **`UNSUPPORTED_PRODUCT_V1`** in **`analysis.flags`** and **`risks`**; **`pricing.status`** / **`cashToClose.status`** stay **`stub`**; **omit `loan.amount`** — no fabricated policy-backed certainty.
4. **Cash-to-close** — **Deterministic**: exact labels, **fixed order** per purpose, **half-up rounding to cents** on each line, **line 6 amount = sum of lines 1–5**, **`estimatedTotal` = line 6 amount** for supported paths. **Unsupported** paths: **`items: []`**, **`estimatedTotal: null`**, **`status: stub`** (see business-rules).
5. **`loan.amount` rule in tests** — **`min(requestedLoanAmount, policyMax)`** if ask present, else **`policyMax`**, asserted in **`policy/recommendedAmount.test.ts`** and contract/golden fixtures — not only inside buried helpers.

---

## Objective

Replace **stubbed** policy behavior behind **`POST /api/deal/analyze`** with a **first-pass Deal Engine policy layer**, **without** changing the frozen **public** request/response shape from TICKET-001/001A:

- **No** new request fields.  
- **No** new top-level response keys (`schemaVersion`, `analysis`, `loan`, `pricing`, `cashToClose`, `risks` only).  
- **Allowed inputs** remain only:  
  - `deal.purpose`, `deal.productType`, `deal.purchasePrice`, `deal.payoffAmount`, `deal.requestedLoanAmount`, `deal.rehabBudget`, `deal.termMonths`  
  - `property.arv`, `property.asIsValue`  
  - `borrower.fico`, `borrower.experienceTier`  
- **TICKET-001A** validation (structural floor, `schemaVersion`, ambiguous shape, canonical numerics, **400** envelope) **unchanged**.  
- **Unsupported `productType`:** **do not** reject at validation time; **HTTP 200** with policy **flags** / **risks** / **`pricing.status`** as specified.  
- **LTC:** not on the public contract; compute **internally** and surface **only** via **`analysis.flags`** and/or **`risks`**.  

**Non-goals:** UI redesign, persistence, PDFs, auth, external APIs, property engine, intelligence engine.

---

## Exact supported product types

**Exact string literals** (no aliases). Callers must send these for supported v1 Bridge paths:

| `deal.purpose` | `deal.productType` |
|----------------|-------------------|
| `purchase`     | `bridge_purchase` |
| `refinance`    | `bridge_refinance` |

Any other `productType` (or mismatch with `purpose`) is **policy-unsupported** for v1: **200** + **`UNSUPPORTED_PRODUCT_V1`** (and related flags) per [risk codes](#stable-risk-codes).

---

## Policy module boundaries

| Module | Responsibility |
|--------|----------------|
| **`validateDealAnalyzeRequest`** (existing) | TICKET-001A floor only: JSON, `schemaVersion`, `deal`/`property` sufficiency, canonical numerics, ambiguous `deal`+`loan`, ignored request `pricing`/`cashToClose` flags. **No** product whitelist here. |
| **`policy/support.ts`** (or equivalent) | Map `(purpose, productType)` → supported v1 program or `unsupported`. |
| **`policy/purchaseMax.ts`** | Purchase **policyMax**: `min(costBasisCap, arvCap)` per [Purchase value logic](#purchase-value-logic). **LTC** computed here or in a shared **`policy/metrics.ts`** for internal use only. |
| **`policy/refinanceMax.ts`** | Refinance **policyMax**: single collateral basis [precedence](#refinance-value-logic); indeterminate basis → no invented max; signals via **`pricing.status`** / **flags** / **risks**. |
| **`policy/recommendedAmount.ts`** | **`min(requestedLoanAmount, policyMax)`** if ask present; else **`policyMax`**. |
| **`policy/pricingStatus.ts`** | Choose **`pricing.status`** from frozen enum given inputs + support + indeterminacy. |
| **`policy/cashToClose.ts`** | Build **`cashToClose.items`** using **only** [fixed labels](#cash-to-close-line-labels) from business-rules; amounts from policy formulas (illustrative). |
| **`policy/risks.ts`** | Build **`risks[]`** using **only** [stable risk codes](#stable-risk-codes); structured `title`/`detail`. |
| **`runDealAnalyze`** (orchestrator) | Parse → validate → normalize legacy if applicable → load constants → run policy → assemble **response** (no new keys). |

**Dependency rule:** policy modules **must not** import UI or HTTP adapters; they accept **normalized canonical input** + **constants** and return **DTOs** consumed by the orchestrator.

---

## Constants / config file plan

| Source | Contents |
|--------|----------|
| [`docs/business-rules/deal-engine-v1-assumptions.md`](../business-rules/deal-engine-v1-assumptions.md) | **Source of truth** for provisional **maxLtcPct**, **maxArvLtvPct**, **maxLtvPct** (refi), **defaultTermMonths**, and narrative precedence. |
| **`src/lib/engines/deal/policy/constants.ts`** (new) | Re-export numeric caps for runtime (single import surface for tests + engine). Values **must match** business-rules until capital signs off; then change **one place** + doc. |
| **`src/lib/engines/deal/schemas/deal-analyze-constants.ts`** (existing) | Keep **`DEAL_ANALYZE_SCHEMA_VERSION`** and shared enums; extend **pricing** / **cashToClose** **status** unions here or in `canonical-response.ts` **without** new top-level response keys. |

**No** new env vars required for v1 policy unless already used elsewhere.

---

## Engine flow

1. **Read body** → **validate** (TICKET-001A unchanged).  
2. **Legacy normalize** (if path applies) → canonical **numbers** only downstream.  
3. **Resolve program support:**  
   - If **`(purpose, productType)`** not in supported table → **policy unsupported** path (still **200** if validation passed): set **`analysis.flags`**, **`risks`** with **`UNSUPPORTED_PRODUCT_V1`**, **`pricing.status`** per [§ Pricing status](#pricing-status-semantics) (e.g. not **`complete`** for a supported path—use **`stub`** or **`needs_review`** / **`insufficient_inputs`** per table below).  
4. **If supported:**  
   - **Purchase:** compute **policyMax** = **min**(costBasisCap, arvCap) with **arv leg** applied **only** when `arv` present and **> 0** (see business-rules).  
   - **Refinance:** choose **one** basis: `asIsValue` if **> 0**, else `arv` if **> 0**, else **indeterminate**.  
5. **Recommended amount** = **`min(requestedLoanAmount, policyMax)`** if ask exists; else **`policyMax`**. If **policyMax** cannot be computed (e.g. refi indeterminate basis), recommended amount rules follow **flags** / **status** (may be `null` or omit per existing **loan** shape—**do not** invent numbers).  
6. **loan.ltv:** compute when definition allows (unit: **0–100 percent**, see below); omit if not meaningful.  
7. **LTC:** compute internally for purchase path; emit **only** in **`analysis.flags`** / **`risks`** (e.g. **`LTC_OVER_LIMIT`** or narrative context per codes).  
8. **pricing:** fill numeric fields where policy defines them; set **`pricing.status`** from [§ Pricing status](#pricing-status-semantics). **`stub`** **must not** appear on **successful supported v1** product paths after this ticket ships.  
9. **cashToClose:** **`items[].label`** **exactly** from [fixed lists](#cash-to-close-line-labels); **`cashToClose.status`** aligned with pricing / policy (extend type beyond **`stub`** only inside existing object).  
10. **risks:** emit from [stable set](#stable-risk-codes); include **basis** flags for refi (**`VALUE_BASIS_ASSUMED`** / context in `detail` as needed).  
11. **analysis:** **`complete` | `incomplete`** + **`flags`** for LTC notes, refi basis, ignored request fields (001A), policy gaps.  

---

## Purchase value logic

**Precedence (frozen):**

\[
\text{policyMax} = \min(\text{costBasisCap}, \text{arvCap})
\]

- **costBasisCap** = `maxLtcPct × (purchasePrice + rehabBudget)`  
- **arvCap** = `maxArvLtvPct × arv` **only when** `arv` is present and **> 0**  
- If **arv** missing or **≤ 0**, **do not** apply the ARV leg; **policyMax** follows cost basis only and **surface** collateral / ARV gaps via **`analysis.flags`**, **`pricing.status`** (**`insufficient_inputs`** / **`indicative`** / **`needs_review`** as appropriate), and **`risks`** (e.g. **`MISSING_COLLATERAL_VALUE`** / **`VALUE_BASIS_ASSUMED`**) — **not** by adding request fields.

**Numeric caps:** `maxLtcPct`, `maxArvLtvPct` from **`deal-engine-v1-assumptions.md`** (provisional).

---

## Refinance value logic

**Single basis — frozen order** (same as business-rules):

1. **`property.asIsValue`** if present and **> 0**  
2. Else **`property.arv`** if present and **> 0**  
3. Else **indeterminate** → **no** silent max; **`insufficient_inputs`** / **`needs_review`** + flags  

**policyMax** = `maxLtvPct × basis` when basis exists.

---

## Output field semantics (within existing keys)

### `loan`

- **Echoed (normalized inputs):** `purpose`, `productType`, `termMonths`, `rehabBudget`, and purpose-specific echoes (`purchasePrice` for purchase; `payoffAmount` / `requestedLoanAmount` for refinance when present)—unchanged intent from TICKET-001.  
- **`loan.amount` (required for TICKET-002):** **Policy-backed recommended loan amount** — **`min(requestedLoanAmount, policyMax)`** when an ask exists; otherwise **`policyMax`** when computable. This is a **nested** field under existing top-level key **`loan`** (not a new top-level response key). Extend **`DealAnalyzeLoanOutV1`** accordingly. When **policyMax** is undefined (e.g. refi indeterminate basis), omit **`amount`** or set **`null`** only if the type allows; prefer **omit + strong `pricing.status` / risks** over inventing a number.  
- **`loan.ltv`:** **0–100 percent** (e.g. `75` = 75%) per [`deal-engine-v1-assumptions.md`](../business-rules/deal-engine-v1-assumptions.md) and [`DealAnalyzeLoanOutV1`](../../src/lib/engines/deal/schemas/canonical-response.ts). Compute only when policy defines numerator/denominator; otherwise omit.  

### `pricing`

- **`status`** enum **extended** (same key):  
  - **`complete`** — Required pricing inputs for policy are present; policy-backed **indicative** numbers populated (**not** a rate lock).  
  - **`indicative`** — Partial inputs; best-effort numbers with gaps flagged.  
  - **`insufficient_inputs`** — Critical inputs missing or indeterminate under frozen rules.  
  - **`needs_review`** — Ambiguous / edge case; human review before relying on numbers.  
  - **`stub`** — **Reserved:** unsupported / pre-migration / explicitly non-policy; **must not** be the steady state for **supported** `bridge_purchase` / `bridge_refinance` success paths after TICKET-002.  

### `cashToClose`

- **`status`** semantics align with policy completeness (mirror **`pricing.status`** rules or a documented mapping in code).  
- **`items`:** labels **only** from [Cash-to-close line labels](#cash-to-close-line-labels).  

### `analysis`

- **`status`** + **`flags`**: policy notes, LTC-only surfacing, refi basis, TICKET-001A ignored fields, completeness.  

### `risks`

- Structured objects only; **`code`** from [stable risk codes](#stable-risk-codes).  

---

## Cash-to-close line labels

**Authoritative:** [`docs/business-rules/deal-engine-v1-assumptions.md`](../business-rules/deal-engine-v1-assumptions.md) § *Cash-to-close line labels*.

**Purchase** — exact strings:

1. `Borrower equity`  
2. `Estimated points`  
3. `Estimated lender fees`  
4. `Estimated closing costs`  
5. `Holdback / reserve (if applicable)`  
6. `Total estimated cash to close`  

**Refinance** — exact strings:

1. `Payoff / unwind amount`  
2. `Estimated points`  
3. `Estimated lender fees`  
4. `Estimated closing costs`  
5. `Reserves / escrows (if applicable)`  
6. `Total estimated cash to close`  

Order may follow policy; **labels** must match **character-for-character**.

---

## Stable risk codes

**Authoritative:** [`docs/business-rules/deal-engine-v1-assumptions.md`](../business-rules/deal-engine-v1-assumptions.md) § *Stable risk codes*.

Use these **`risks[].code`** values before adding any new code (spec + business-rules revision required):

| Code |
|------|
| `REQUEST_EXCEEDS_POLICY_MAX` |
| `LTV_OVER_LIMIT` |
| `LTC_OVER_LIMIT` |
| `MISSING_COLLATERAL_VALUE` |
| `MISSING_BORROWER_PRICING_INPUT` |
| `UNSUPPORTED_PRODUCT_V1` |
| `VALUE_BASIS_ASSUMED` |
| `TERM_OUT_OF_RANGE` |

Map founder scenarios to these (e.g. unsupported product → **`UNSUPPORTED_PRODUCT_V1`**; LTV threshold → **`LTV_OVER_LIMIT`**). **Do not** emit ad-hoc codes outside this set without updating the business-rules doc.

---

## Error / flag behavior

| Situation | HTTP | Notes |
|-----------|------|--------|
| TICKET-001A validation failure | **400** | Unchanged codes + `{ error, code, issues }`. |
| Valid contract, unsupported product | **200** | **`UNSUPPORTED_PRODUCT_V1`**, **`analysis.flags`**, **`pricing.status`** not **`complete`**. |
| Valid contract, supported product, missing borrower info for pricing | **200** | **`MISSING_BORROWER_PRICING_INPUT`** / flags as applicable. |
| Policy max binds to LTC vs ARV leg (purchase) | **200** | **`analysis.flags`** / **`risks`** to explain binding (align with **`LTC_OVER_LIMIT`** / **`REQUEST_EXCEEDS_POLICY_MAX`** as appropriate). |

**Never** add new **400** codes for “wrong product” when the payload passes TICKET-001A.

---

## File plan

**Create**

- `src/lib/engines/deal/policy/constants.ts` — caps from business-rules  
- `src/lib/engines/deal/policy/support.ts` — supported product table  
- `src/lib/engines/deal/policy/purchaseMax.ts`  
- `src/lib/engines/deal/policy/refinanceMax.ts`  
- `src/lib/engines/deal/policy/recommendedAmount.ts`  
- `src/lib/engines/deal/policy/pricingStatus.ts`  
- `src/lib/engines/deal/policy/cashToClose.ts`  
- `src/lib/engines/deal/policy/risks.ts`  
- `src/lib/engines/deal/policy/index.ts` — public orchestration helpers (optional)  
- `docs/briefs/TICKET-002.md` — Scout brief  

**Modify**

- `src/lib/engines/deal/analyze.ts` — wire policy layer; remove steady-state **stub** for supported paths  
- `src/lib/engines/deal/schemas/canonical-response.ts` — extend **`pricing.status`** / **`cashToClose.status`** unions; keep **same** top-level keys  
- Tests under `src/lib/engines/deal/` (or `__tests__/`) — golden cases per below  

**Do not modify** (unless required for types only): route handler shape, request schema keys, legacy adapter behavior (001A).

---

## Tests

1. **Supported purchase** `bridge_purchase` — **policyMax** matches **min**(cost basis cap, ARV cap) with provisional constants; **loan** amount rule **min**(ask, max) or max.  
2. **Purchase** missing **arv** or **arv ≤ 0** — ARV leg omitted; flags/pricing reflect gap; **no** invented request fields.  
3. **Supported refinance** `bridge_refinance` — basis **asIs** preferred over **arv**; **`VALUE_BASIS_ASSUMED`** / risks when documented.  
4. **Refinance** no positive basis — **`insufficient_inputs`** or **`needs_review`**; no fake **policyMax**.  
5. **Unsupported** `productType` — **200**, **`UNSUPPORTED_PRODUCT_V1`**, not **400**.  
6. **LTC** appears only in **flags** / **risks**, not new top-level key.  
7. **`loan.ltv`** unit test per **DOC-001** (0–100 convention).  
8. **Cash-to-close** labels match business-rules **exactly** (purchase vs refi).  
9. **Supported** paths: **`pricing.status`** is **not** **`stub`**.  
10. TICKET-001A regression: **schemaVersion**, ambiguous **deal**+**loan**, ignored request **pricing**/**cashToClose** flags unchanged.  

---

## Definition of done

- [x] Policy layer implements **exact** supported **`productType`** strings and **formulas** / **precedence** from this spec + **`deal-engine-v1-assumptions.md`**.  
- [x] No new request fields; no new top-level response keys; TICKET-001A validation behavior preserved.  
- [x] Unsupported products → **200** + policy surfaces, **not** **400**.  
- [x] **`loan.ltv`** in **0–100 percent**; **LTC** only in **flags** / **risks** (see also [`TICKET-002A`](./TICKET-002A.md) for purchase LTC surfacing).  
- [x] **Cash-to-close** labels and **risk codes** match **business-rules** file.  
- [x] **`stub`** does not appear on **normal success** for **bridge_purchase** / **bridge_refinance**.  
- [x] Tests above pass; no UI redesign, persistence, PDFs, auth, or external APIs.  

---

## Closure

**Closed:** 2026-04-17. Deal Engine **policy layer v1** is implemented behind the frozen **`deal_analyze.v1`** contract: supported product literals, **`loan.amount`** semantics, pricing/cash status vocabulary, deterministic cash-to-close lines, stable risks, and unsupported-product **200** behavior. LTC observability and purchase binding-leg flags are covered by **[`TICKET-002A`](./TICKET-002A.md)** (closed same release).

**Follow-up (non-blocking):** [`DOC-002`](./DOC-002.md) — assumptions doc polish (flag codes + copy).

---

## Appendix — Recommended loan amount (normative)

- If **`requestedLoanAmount`** is present (applicable per purpose): **recommended = `min(requestedLoanAmount, policyMax)`**.  
- Else: **recommended = `policyMax`** (when **policyMax** is defined).  

*(Same as business-rules § Recommended amount rule.)*
