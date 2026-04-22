# BUILD SPEC ADDENDUM — TICKET-002A (LTC surfacing & limiting-factor signals)

**Status:** closed (completed 2026-04-17)  
**Last updated:** 2026-04-17  
**Parent:** [`TICKET-002`](./TICKET-002.md) (closed) — LTC surfacing & limiter signals  
**Contracts:** [`TICKET-001`](./TICKET-001.md), [`TICKET-001A`](./TICKET-001A.md) — **frozen** request + top-level response keys

**Scope:** Minimal. Supported **purchase** paths only for new LTC/limiting-factor behavior. No new request fields, no new top-level response keys, no UI, persistence, PDFs, or auth.

---

## Changed rules

### 1. LTC computation (supported purchase only)

When **all** of the following hold:

- `deal.purpose === "purchase"` and `deal.productType === "bridge_purchase"` (supported path), and  
- **`purchasePrice`** and **`rehabBudget`** (after TICKET-001 default) yield a **positive** cost basis **`basis = purchasePrice + rehabBudget`**,  

then the policy layer **must** compute internally:

- **`ltcCap`** = `maxLtcPct × basis` (same numeric value as the purchase **cost-basis cap** leg; use the same constant source as `purchaseMax` / `deal-engine-v1-assumptions.md`).  
- **`ltcRatioPercent`** = `(requestedLoanAmount ?? loan.amount ?? policy-backed amount under evaluation) / basis × 100` **only when** the numerator used for the check is defined; otherwise compute ratio for **flags** using **`loan.amount`** after recommendation is finalized (see implementation order in **Engine ordering**).

These values stay **internal** to policy unless surfaced via **`analysis.flags`** / **`risks`** per rules below — **no** `loan.ltc` reuse for LTC (LTC ≠ LTV).

### 2. `LTC_OVER_LIMIT` risk (ask exceeds LTC cap)

When a supported purchase scenario has a calculable **`ltcCap`** and **`deal.requestedLoanAmount`** is **present** and **`deal.requestedLoanAmount > ltcCap`** (strict `>`; equality is **not** over-limit):

- Emit exactly one **`risks[]`** entry with **`code: "LTC_OVER_LIMIT"`** (must match stable set in [`deal-engine-v1-assumptions.md`](../business-rules/deal-engine-v1-assumptions.md)).

### 3. Limiting-factor signals (which leg binds `policyMax`)

When **both** legs are computable for purchase (`arvCap` defined with **`arv > 0`** **and** `costBasisCap` defined from positive **`basis`**):

Let **`policyMax = min(costBasisCap, arvCap)`** (existing TICKET-002 rule).

Emit **`analysis.flags`** (deterministic):

| Condition | Action |
|-----------|--------|
| `policyMax === costBasisCap` **and** `costBasisCap < arvCap` | Add flag **`PURCHASE_POLICY_MAX_BINDS_LTC`** (LTC / cost-basis leg is **strictly** tighter). |
| `policyMax === arvCap` **and** `arvCap < costBasisCap` | Add flag **`PURCHASE_POLICY_MAX_BINDS_ARV`**. |
| `policyMax === costBasisCap` **and** `policyMax === arvCap` (within **1 cent** tolerance: `\|a-b\| ≤ 0.01`) | Add **both** flags **`PURCHASE_POLICY_MAX_BINDS_LTC`** and **`PURCHASE_POLICY_MAX_BINDS_ARV`**. |

**Do not** emit binding flags when only one leg exists (e.g. no ARV leg): limiting-factor comparison is **not applicable**.

**Decision (flag vs risk):**

- **Binding leg** (`PURCHASE_POLICY_MAX_BINDS_*`): **`analysis.flags` only** — severity **`info`**. These are **diagnostic**, not policy violations by themselves.  
- **Ask vs LTC cap** (`LTC_OVER_LIMIT`): **`risks` only** — severity **`high`**. Do **not** duplicate the same semantic as a flag for TICKET-002A (avoids double-counting in UI).

### 4. Contract discipline

- **No** new request fields; **no** new top-level response keys.  
- Only additional **`analysis.flags`**, **`risks[]`**, and richer **`context` / `detail`** inside existing shapes.  
- **`AnalysisFlag.code`** may use **`PURCHASE_POLICY_MAX_BINDS_LTC`** / **`PURCHASE_POLICY_MAX_BINDS_ARV`** (not in the stable **risk** code table — **flags** are allowed to introduce new **flag** codes; document them in `deal-engine-v1-enums.ts` or equivalent next to other flag codes).

### 5. Preserve TICKET-001A, TICKET-002

- All existing validation, unsupported product behavior, cash-to-close determinism, **`loan.amount`**, **`loan.ltv`**, and golden tests **must** remain green.  
- Add **focused** tests for 002A only; do not weaken prior assertions.

### 6. Refinance `MISSING_COLLATERAL_VALUE`

**Decision:** **Unchanged** in TICKET-002A — no copy or branching change to refinance collateral / `MISSING_COLLATERAL_VALUE` wording or emission rules. Any clarification belongs in a **separate** doc or **TECH-** ticket to avoid scope creep.

---

## Exact codes, severities, payloads

### Risk — `LTC_OVER_LIMIT`

| Field | Value |
|--------|--------|
| `code` | `LTC_OVER_LIMIT` |
| `severity` | **`high`** |
| `title` | `Requested loan exceeds LTC limit` |
| `detail` | See **Normative `detail` format** below (single sentence pattern; numeric segments formatted **half-up to cents** using the same rounding rule as cash-to-close lines). |

**Normative `detail` format** (concatenate in this order; `fmt(x)` = `Math.round(Number(x) * 100) / 100`):

```text
Requested amount {fmt(requestedLoanAmount)} exceeds the LTC-based maximum {fmt(ltcCap)} ({maxLtcPct} of cost basis {fmt(basis)}). The recommended amount is capped; confirm leverage with capital policy.
```

**Example** (fixture): `requestedLoanAmount = 800000`, `ltcCap = 750000`, `maxLtcPct = 0.75`, `basis = 1000000` →

`Requested amount 800000 exceeds the LTC-based maximum 750000 (0.75 of cost basis 1000000). The recommended amount is capped; confirm leverage with capital policy.`

*(If integers are whole dollars, trailing `.00` is optional provided tests and implementation agree on one stable formatter.)*

**Structured context on risks:** **`DealAnalyzeRiskV1`** has **`detail: string` only** in v1 — put all numeric traceability in the **`detail`** string for TICKET-002A; **`analysis.flags`** may use **`context`** as specified above.

### Flags — `PURCHASE_POLICY_MAX_BINDS_LTC`

| Field | Value |
|--------|--------|
| `code` | `PURCHASE_POLICY_MAX_BINDS_LTC` |
| `severity` | **`info`** |
| `message` | `Purchase policy maximum is limited by the LTC (cost-basis) cap rather than the ARV cap.` |
| `context` (optional but recommended) | `{ "costBasisCap": number, "arvCap": number, "policyMax": number, "maxLtcPct": number, "maxArvLtvPct": number }` |

### Flags — `PURCHASE_POLICY_MAX_BINDS_ARV`

| Field | Value |
|--------|--------|
| `code` | `PURCHASE_POLICY_MAX_BINDS_ARV` |
| `severity` | **`info`** |
| `message` | `Purchase policy maximum is limited by the ARV cap rather than the LTC (cost-basis) cap.` |
| `context` (optional) | Same keys as LTC-bind flag for traceability. |

### Engine ordering (normative)

To avoid circular definitions:

1. Compute **`costBasisCap`**, **`arvCap`** (if applicable), **`policyMax`**, **`ltcCap`**.  
2. Emit **binding flags** from §3.  
3. Compute **`loan.amount`** (existing TICKET-002 rule).  
4. Evaluate **`LTC_OVER_LIMIT`** using **`deal.requestedLoanAmount`** vs **`ltcCap`** (not vs `loan.amount`).

---

## File plan

**Modify**

- `src/lib/engines/deal/policy/purchaseMax.ts` (or equivalent) — expose **`ltcCap`**, **`costBasisCap`**, **`arvCap`**, **`policyMax`** to orchestrator or return a small **result DTO** used by flags.  
- `src/lib/engines/deal/policy/risks.ts` — append **`LTC_OVER_LIMIT`** emission when rule §2 fires; ensure ordering does not duplicate with other risks.  
- `src/lib/engines/deal/analyze.ts` (or policy orchestration entry) — merge **binding flags** into **`analysis.flags`** after existing flags, **deduped** by `code`.  
- `src/lib/engines/deal/schemas/` or **`deal-engine-v1-enums.ts`** — register new **flag** codes `PURCHASE_POLICY_MAX_BINDS_LTC` / `PURCHASE_POLICY_MAX_BINDS_ARV` if you maintain an allowlist.  
- Tests: **`policy/purchaseMax.test.ts`**, **`analyze` integration** or contract tests.

**Do not**

- Add **`loan.ltc`** or top-level **`ltc`**.  
- Change TICKET-001A validators or **400** codes.  
- Alter refinance **`MISSING_COLLATERAL_VALUE`** text in this ticket.

---

## Tests

1. **Supported purchase**, both legs, `costBasisCap < arvCap` → **`PURCHASE_POLICY_MAX_BINDS_LTC`** present; **no** `PURCHASE_POLICY_MAX_BINDS_ARV`.  
2. **Supported purchase**, both legs, `arvCap < costBasisCap` → **`PURCHASE_POLICY_MAX_BINDS_ARV`** only.  
3. **Tie** within 1¢ → **both** bind flags.  
4. **`requestedLoanAmount > ltcCap`** → **`LTC_OVER_LIMIT`** risk, **`high`**, title/detail match **Exact codes** (substring assertions).  
5. **`requestedLoanAmount === ltcCap`** → **no** `LTC_OVER_LIMIT`.  
6. **No ARV leg** (arv missing or ≤0) → **no** binding **ARV/LTC limiting** flags from §3 (only one leg — flags not applicable).  
7. Regression: full TICKET-001A + TICKET-002 test suites unchanged (CI green).

---

## Definition of done

- [x] Supported purchase paths compute **LTC basis** and **`ltcCap`** internally when basis is positive.  
- [x] **`LTC_OVER_LIMIT`** emitted per §2 with **`high`** severity and frozen **title** / **detail** pattern.  
- [x] **Binding leg** signals emitted **only** as **`analysis.flags`** per §3; **no** duplicate binding signal as a risk in 002A.  
- [x] No new request fields; no new top-level response keys; refi **`MISSING_COLLATERAL_VALUE`** unchanged.  
- [x] All TICKET-001A / TICKET-002 behaviors and tests preserved; new tests in § **Tests** pass.  

---

## Closure

**Closed:** 2026-04-17. Purchase **LTC** diagnostics, **`LTC_OVER_LIMIT`** risk semantics, and **`PURCHASE_POLICY_MAX_BINDS_LTC`** / **`PURCHASE_POLICY_MAX_BINDS_ARV`** (and related) **analysis.flags** behavior are implemented and tested per this addendum.

**Follow-up (non-blocking):** [`DOC-002`](./DOC-002.md) — sync **business-rules** assumptions with final flag codes and tighten analysis copy (P2 polish).
