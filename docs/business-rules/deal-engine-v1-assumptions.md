# Deal Engine v1 assumptions

**Source of truth for Builder:** this file plus [`docs/specs/TICKET-002.md`](../specs/TICKET-002.md). Numeric caps below are **provisional** until T1F policy signs final investor/product numbers — replace placeholders in one place and keep the engine in sync.

**Code map (single source, not vibes):** `deal-engine-v1-enums.ts` (frozen strings + enums), `policy/constants.ts` (embedded defaults + cash-to-close multipliers), `policy/support.ts`, `policy/purchaseMax.ts`, `policy/refinanceMax.ts`, `policy/recommendedAmount.ts`, `policy/pricingStatus.ts`, `policy/risks.ts`, `policy/cashToClose.ts` (re-exports `cashToCloseLines.ts`), `policy/cashToCloseLines.ts`, `policy/index.ts`, `analyze.ts`.

**Admin-driven config (POLICY-ADOPTION-001):** Published `rule_sets` of type `rates` and `calculator_assumptions`, resolved via CONTENT-002 bindings for `tool_key = deal_engine` (`rates_rule_set`, `calculator_assumptions_rule_set`), override the embedded defaults for pricing scalars, leverage caps, default term, LTV screen threshold, and cash-to-close **multipliers** (labels/order stay fixed in code). See [`docs/specs/POLICY-ADOPTION-001.md`](../specs/POLICY-ADOPTION-001.md).

---

## Supported product types

- purchase: `bridge_purchase`
- refinance: `bridge_refinance`

---

## Policy constants

*Provisional — confirm with capital / credit policy.*

### Purchase path

- maxLtcPct: `0.75` (75% of cost basis: purchasePrice + rehabBudget)
- maxArvLtvPct: `0.70` (70% of ARV)
- defaultTermMonths: `12`

### Refinance path

- maxLtvPct: `0.75` (75% of chosen collateral basis)
- defaultTermMonths: `12`

---

## Value basis precedence

### Purchase path

Compute **policyMaxPurchase** = **min**(costBasisCap, arvCap):

- **costBasisCap** = maxLtcPct × (purchasePrice + rehabBudget)
- **arvCap** = maxArvLtvPct × arv **only when** `arv` is present and **> 0**. If `arv` is missing or ≤ 0, **do not** apply the ARV leg; policy max is driven by cost basis and collateral gaps are surfaced via flags / pricing status (see TICKET-002).

### Refinance path

Single basis, frozen order:

1. Use **asIsValue** when present and **> 0**.
2. Else use **arv** when present and **> 0**.
3. If neither yields a positive basis, collateral is indeterminate — do not invent a max without inputs; use **`insufficient_inputs`** / **`needs_review`** and policy flags.

---

## Recommended amount rule (`loan.amount`)

**Field name is frozen as `loan.amount`** (not `recommendedAmount`). Semantics: **policy-backed recommended loan amount**.

- if `requestedLoanAmount` exists: **min(requestedLoanAmount, policyMax)**
- else: **policyMax**

*(policyMax follows purpose-specific value logic above.)*

**Unsupported products:** omit **`loan.amount`** entirely — do not imply a policy-backed recommendation.

---

## LTV / LTC units

- **loan.ltv** uses: **0–100 percent** (e.g. `75` = 75% LTV), consistent with [`DealAnalyzeLoanOutV1`](../../src/lib/engines/deal/schemas/canonical-response.ts) and [`DOC-001`](../specs/DOC-001.md).
- **LTC** is: **internal-only** — computed in policy logic and surfaced through **`analysis.flags`** / **`risks`** only until a future contract revision adds a public field.

---

## Pricing status rules

Aligned with [`TICKET-002`](../specs/TICKET-002.md) §9.

- **complete** means: Required pricing inputs are present; policy-backed **indicative** numbers are populated (still not a rate lock or disclosure-grade quote).
- **insufficient_inputs** means: Critical inputs are missing or indeterminate so policy pricing cannot be completed under the frozen rules.
- **stub** should: **Disappear** for supported v1 product paths once policy is wired; **remain** only for unsupported products, pre-migration responses, or explicitly non-policy surfaces until retired.

*(Also used: `indicative`, `needs_review` — see TICKET-002.)*

---

## Cash-to-close (deterministic rules)

**Source of implementation:** `src/lib/engines/deal/policy/cashToCloseLines.ts` (must match this section).

- **Exact labels** — Use only the strings in § *Cash-to-close line labels* below (character-for-character). Builder must not vary wording between runs.
- **Exact order** — Items appear **only** in the order listed for that purpose (purchase vs refinance).
- **Rounding** — Each component line uses **half-up to cents**: `Math.round(amount * 100) / 100`.
- **Total row** — The **sixth** line is always **`Total estimated cash to close`**; its **`amount`** equals the **sum of amounts on lines 1–5** (after per-line rounding).
- **`estimatedTotal`** — On supported policy paths, equals the **sixth line’s `amount`** (same as sum-of-lines contract).
- **Unsupported `productType`** — **No** fabricated cash sketch: `cashToClose.status` = **`stub`**, `items` = **`[]`**, `estimatedTotal` = **`null`**.

---

## Cash-to-close line labels

**Fixed strings** for `cashToClose.items[].label` (no free-form copy, no formulas embedded in labels). Amounts are numeric; semantics are illustrative / internal until disclosure-grade product exists.

### Purchase

- Borrower equity
- Estimated points
- Estimated lender fees
- Estimated closing costs
- Holdback / reserve (if applicable)
- Total estimated cash to close

### Refinance

- Payoff / unwind amount *(v1 internal sketch: line amount uses policy-backed **`loan.amount`** as the unwind reference; not a wire instruction.)*
- Estimated points
- Estimated lender fees
- Estimated closing costs
- Reserves / escrows (if applicable)
- Total estimated cash to close

---

## Stable risk codes

Use **`risks[].code`** from this set before adding new codes (revise via spec + this file together).

- `REQUEST_EXCEEDS_POLICY_MAX`
- `LTV_OVER_LIMIT`
- `LTC_OVER_LIMIT`
- `MISSING_COLLATERAL_VALUE`
- `MISSING_BORROWER_PRICING_INPUT`
- `UNSUPPORTED_PRODUCT_V1`
- `VALUE_BASIS_ASSUMED`
- `TERM_OUT_OF_RANGE`

---

## Non-binding / “estimated” (unchanged)

Outputs labeled **estimated** are **directional** for internal workflow, not guaranteed to match final underwriting, investor pricing, or third-party fees — not a rate lock or commitment unless stated elsewhere. Deal analyze remains **internal prioritization and conversation**, not borrower-facing regulatory disclosure.

---

*Last updated: 2026-04-17*
