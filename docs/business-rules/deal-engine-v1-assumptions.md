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

#### Published Tier 3 purchase rule (2026-10-21)

The generic provisional scalars above are **not** the Tier 3 purchase rule. A bound
`calculator_assumptions` payload may include an optional top-level `purchaseTierRules`
map. Each canonical numeric tier key maps to `initialAdvancePct`, `rehabAdvancePct`,
and `maxArvLtvPct` fractions. The verified Tier 3 publication payload is
[`../operations/tier3-purchase-policy-2026-10-21.json`](../operations/tier3-purchase-policy-2026-10-21.json),
with policy provenance and the limited scope of verification recorded there.

- Tier 3: 85% of purchase price plus 100% of financed SOW, limited to 75% of ARV.
- The complete financed SOW holdback is reserved first; remaining proceeds are the initial acquisition loan.
- A lower requested total remains respected. If it or the ARV cap cannot fund the configured holdback,
  withhold loan/cash-to-close amounts, mark the analysis incomplete and pricing `needs_review`,
  and emit `PURCHASE_REHAB_HOLDBACK_SHORTFALL`.
- Missing or invalid published Tier 3 configuration does not fall through to the generic 75%-of-cost rule:
  withhold amounts and emit `PURCHASE_TIER_POLICY_UNAVAILABLE` with `needs_review` pricing.
- Tier 3 displayed **Initial LTC** is acquisition divided by purchase price; future SOW is separately held back.
  Total LTC remains total loan divided by purchase plus rehab. Existing other-tier/refinance display is unchanged.
- Existing Tier 1/2 and refinance sizing/allocation behavior is preserved; this narrow repair does not certify
  the rest of the engine as a complete implementation of current credit policy.

### Refinance path

- maxLtvPct: `0.75` (75% of chosen collateral basis)
- defaultTermMonths: `12`

#### Explicit seasoned refinance with SOW, Tier 0/1 (2026-10-26)

For `deal.purpose = refinance`, `programContext.scenario = refinance_seasoned`, and
positive `deal.rehabBudget`, the verified Tier 0/1 **total** loan cap is **70% of ARV**.
Source: Tier One Funding Credit Policy v8.2026, table 4.1,
the specific "Seasoned Refinance ARV LTV (w/SOW)" row; user confirmed this written-policy
cap on 2026-10-26. Do not substitute the general 75% ARV row or the completed-rehab-only
75% AIV program. The generic refinance scalar above does not override this narrow branch.

- Require a positive ARV and explicit Tier 0 or Tier 1 (`0`/`1`, `T0`/`T1`, or `Tier 0`/`Tier 1`).
  Missing ARV never falls back to as-is; missing/unsupported tiers never fall through to generic sizing.
- Missing inputs/policy mapping withhold loan and cash-to-close amounts, mark analysis incomplete and
  pricing `needs_review`, and emit `MISSING_COLLATERAL_VALUE` or `SEASONED_REFINANCE_POLICY_UNAVAILABLE`.
- Respect `min(requestedLoanAmount, 70% × ARV)`, or the ARV cap when no request is given.
- Reserve the **entire financed rehab budget** before allocating the remaining initial advance.
  If the requested/capped total cannot cover it, withhold amounts and emit
  `REFINANCE_REHAB_HOLDBACK_SHORTFALL`; never silently shrink the holdback.
- Require `assumptions.borrowingRehabFunds === true` (a boolean). An explicit seasoned scenario
  with no positive rehab or missing/invalid/declined funding is unsupported by this narrow mapping:
  withhold amounts with `SEASONED_REFINANCE_POLICY_UNAVAILABLE`, not generic AIV sizing.
- The ARV basis is deliberate, not `VALUE_BASIS_ASSUMED`. No independent as-is initial cap is added here.
- Generic refinance with no explicit seasoned scenario, other scenarios, and purchase behavior are unchanged.
  This is a narrow verified correction, not certification of all other existing engine rules.

---

## Value basis precedence

### Purchase path

Compute **policyMaxPurchase** = **min**(costBasisCap, arvCap):

- **costBasisCap** = maxLtcPct × (purchasePrice + rehabBudget)
- **arvCap** = maxArvLtvPct × arv **only when** `arv` is present and **> 0**. If `arv` is missing or ≤ 0, **do not** apply the ARV leg; policy max is driven by cost basis and collateral gaps are surfaced via flags / pricing status (see TICKET-002).

### Refinance path

Except for the explicit seasoned Tier 0/1 rehab branch above, single basis, frozen order:

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

### Refinance rehab allocation

When the borrower takes rehab funds, reserve the rehab budget from the recommended total loan first, up to the available total on legacy paths. The explicit seasoned Tier 0/1 rehab path instead withholds sizing if that total cannot fund the entire holdback. The initial advance is the remaining total loan. This preserves the requested rehab holdback rather than prorating it against the outstanding payoff. When the borrower declines rehab funds, the whole recommended amount is the initial advance. The refinance total-loan cap and `REQUEST_EXCEEDS_POLICY_MAX` behavior still apply before allocation.

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
- **Refinance payoff contribution** — `Payoff / unwind amount` is the borrower-funded payoff gap: `max(0, payoffAmount − acquisitionLoanAmount)`. Financed rehab is held back and cannot reduce that gap. If the actual payoff is omitted, `cashToClose.status` = **`insufficient_inputs`**, `items` = **`[]`**, and `estimatedTotal` = **`null`**; sizing and loan terms can still be populated.

### Origination-aware loan fees (Term Sheet / LSA)

When the normalized request includes **`assumptions.originationPointsPercent`** and/or **`assumptions.originationFlatFee`** (see `parseDealStructuringAssumptions` in `loanStructuring.ts`), **`Estimated points`** and **`Estimated lender fees`** are **not** computed from published `calculator_assumptions` CTC multipliers × purchase price. Instead:

- **`Estimated points`** = `feeBasisTotalLoan × (originationPointsPercent / 100)` with `feeBasisTotalLoan` = policy-backed **`loan.amount`** (total loan).
- **`Estimated lender fees`** = `originationFlatFee` (dollars).

If neither assumption is sent, the legacy illustrative model applies: CTC points % and lender-fees % × **purchase price** (purchase) or × **reference amount** (refinance). **`Estimated closing costs`** still uses the purchase/reference amount × `ctcClosingCostsPct` (unchanged).

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

- Payoff / unwind amount *(borrower contribution needed after initial loan funds are applied to the entered payoff)*
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
- `SEASONED_REFINANCE_POLICY_UNAVAILABLE`
- `REFINANCE_REHAB_HOLDBACK_SHORTFALL`

---

## Non-binding / “estimated” (unchanged)

Outputs labeled **estimated** are **directional** for internal workflow, not guaranteed to match final underwriting, investor pricing, or third-party fees — not a rate lock or commitment unless stated elsewhere. Deal analyze remains **internal prioritization and conversation**, not borrower-facing regulatory disclosure.

---

*Last updated: 2026-10-26*
