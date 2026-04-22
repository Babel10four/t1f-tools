# Cash to Close Estimator — frozen UI contract (Architect)

**Status:** approved (freeze)  
**Last updated:** 2026-04-17  
**API consumer:** [`POST /api/deal/analyze`](../../src/lib/engines/http.ts) — **`schemaVersion: deal_analyze.v1`** only.  
**Policy / engine:** [`TICKET-002`](./TICKET-002.md), [`docs/business-rules/deal-engine-v1-assumptions.md`](../business-rules/deal-engine-v1-assumptions.md)

This tool uses the **same narrow request model** as the sibling rep tools (**Loan Structuring Assistant**, **Pricing Calculator**). Architect must **not** infer fields from briefs that say “mirror” other tools — **only** the tables below apply.

---

## 1. Route and product naming

| Item | Frozen value |
|------|----------------|
| **Route** | **`/tools/cash-to-close-estimator`** |
| **Page title / product label (browser + H1)** | **Cash to Close Estimator** |

**Related routes (unchanged roles):**

| Route | Role |
|-------|------|
| `/tools/loan-structuring-assistant` | Sibling rep tool (structuring) |
| `/tools/pricing-calculator` | Sibling rep tool (pricing) |
| `/tools/deal-analyzer` | Internal JSON harness |

---

## 2. Flow-to-payload mapping (frozen)

Same mapping as sibling tools. The flow control is **UI-only** and serializes into the **existing** request shape. **No new API enum** and **no new request keys.**

| UI flow | `deal.purpose` | `deal.productType` |
|---------|----------------|---------------------|
| Purchase | `purchase` | `bridge_purchase` |
| Refinance | `refinance` | `bridge_refinance` |

---

## 3. Exact input set (v1)

Only fields the **frozen contract** already accepts. If a field is **not** listed here, this UI **does not** collect it.

**Forbidden:** occupancy, client pricing inputs, request `cashToClose` / `pricing` / top-level `loan` as inputs, margin fields, or any field not in TICKET-001/001A request tables.

### Purchase flow

| UI concept | JSON path | Rule |
|------------|-----------|------|
| Purchase price | `deal.purchasePrice` | **Required** |
| Rehab budget | `deal.rehabBudget` | Optional; default **`0`** if omitted |
| Property value (primary) | `property.arv` | **Recommended required** for this UI flow |
| Requested loan amount | `deal.requestedLoanAmount` | Optional |
| Term (months) | `deal.termMonths` | Optional; use **`null`** when unknown |
| FICO | `borrower.fico` | Optional |
| Experience tier | `borrower.experienceTier` | Optional |

Always send: `schemaVersion: "deal_analyze.v1"`, `deal.purpose`, `deal.productType` per §2.

### Refinance flow

| UI concept | JSON path | Rule |
|------------|-----------|------|
| Payoff amount | `deal.payoffAmount` | |
| Requested loan amount | `deal.requestedLoanAmount` | **At least one** of `payoffAmount` or `requestedLoanAmount` |
| Property value (primary) | `property.asIsValue` | **Recommended required** for this UI flow |
| ARV (secondary) | `property.arv` | Optional |
| Term (months) | `deal.termMonths` | Optional; **`null`** when unknown |
| FICO | `borrower.fico` | Optional |
| Experience tier | `borrower.experienceTier` | Optional |

**Refinance ask rule (UI):** If **`payoffAmount`** is set, **`requestedLoanAmount`** is optional. If **`payoffAmount`** is not set, **`requestedLoanAmount`** is **required**.

---

## 4. Cash display behavior (frozen)

Primary focus of this tool is **`cashToClose`** — still **server-authoritative**.

| Rule | Behavior |
|------|------------|
| Primary number | **`cashToClose.estimatedTotal`** is the headline number when present. |
| Line items | Render **`cashToClose.items` in exact server order** with **exact server `label` strings** (no relabeling). |
| Null total | If **`estimatedTotal` is `null`**, **do not** compute a sum from line items in the browser. |
| Empty items | If **`items` is `[]`**, show explicitly that **no line items were returned** — **do not** invent placeholder rows. |
| Estimate quality / caveats | Explanation comes from **`analysis.status`**, **`analysis.flags`**, and **`risks`** only — **no** client-authored pseudo-underwriting copy. |

---

## 5. Client boundary (frozen)

### Allowed

- Serialize request fields per §3  
- Format money for display (formatting only)  
- Order panels (cash-first layout recommended; see §6)  
- Render server **`analysis.flags`** and **`risks`** verbatim  
- Loading and error states per §7  

### Forbidden

- Compute fees, proceeds, or caps  
- **Sum** line items to fill a **missing** total when **`estimatedTotal` is `null`**  
- Calculate cash-to-close **independently** of the server response  
- Infer “completeness” or quality from missing fields beyond what the **server** returns  
- Rewrite **severities** or invent **recommendations**  

**Server output stays authoritative.**

---

## 6. Suggested results layout (cash-centric)

Order is **guidance** for this screen; §4 rules always win.

1. **Summary:** **`cashToClose.estimatedTotal`** (when not `null`) + **`cashToClose.status`**  
2. **Cash to Close panel:** **`items`** (server order, server labels)  
3. **`analysis.status`** + **`analysis.flags`** (server text)  
4. **`risks`** (grouped by server `severity`; server `title` / `detail` only)  
5. Secondary details as needed (e.g. **`loan.amount`**, **`pricing.status`**) without duplicating cash math  

Do **not** add a primary tile for raw **LTC** unless the API exposes a numeric **`loan.ltc`-style field** for this response; otherwise treat LTC-related signals as **flags/risks** only.

---

## 7. State model (frozen)

| State | Meaning |
|-------|---------|
| `idle` | No in-flight request |
| `editing` | User changed inputs since last result (optional; may fold into `idle`) |
| `submitting` | Request in flight |
| `success` | **2xx** with parsed body |
| `error_4xx` | **4xx** — render **`error`**, **`code`**, **`issues`** from JSON when present |
| `error_5xx` | **5xx** or network failure |

Same **4xx** envelope as sibling tools: never show only `"HTTP 400"` when the body includes structured fields.

---

## 8. Definition of done (UI implementation)

- [ ] Route **`/tools/cash-to-close-estimator`** with title **Cash to Close Estimator**.  
- [ ] Payloads match §2–§3 only.  
- [ ] Cash UI follows §4–§5; state model §7.  
- [ ] No forbidden client logic.  
