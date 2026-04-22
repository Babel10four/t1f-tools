# RURAL-DATA-001 — Initial `rural_rules` load + Rural Checker bindings

**Status:** implemented — **pending audit** and **real data load** (not fully closed)  
**Last updated:** 2026-04-16  
**Depends on:** [`CONFIG-001`](./CONFIG-001.md) (`rural_rules`), [`CONTENT-002`](./CONTENT-002.md) bindings, [`TICKET-008`](./TICKET-008.md) (Rural Checker — **closed**)  
**Pairs with:** [`DATA-001`](./DATA-001.md) (optional — may already seed the same `rural_policy` PDF)

---

## Goal

Ensure **Rural Checker** evaluates against a **published structured `rural_rules`** rule set (not PDF text at runtime), and that the tool is **bound** to:

| `tool_key`      | `binding_type`               | Purpose |
|-----------------|------------------------------|---------|
| `rural_checker` | `rural_rules_rule_set`     | **Required** — scoring / outcomes from validated JSON (`evaluation` block). |
| `rural_checker` | `rural_policy_document`    | **Optional metadata** — title / version for UI; **no** PDF evaluation. |

---

## Policy hierarchy (do not collapse)

| Layer | Role |
|-------|------|
| **Rural PDF** (`rural_policy` document) | Governed **source / reference** for humans and attribution. |
| **`rural_rules` rule_set** | **Executable runtime truth** — thresholds and scoring live in validated JSON. |
| **Rural Checker** | **Deterministic evaluator** over published `rural_rules` only — it does not parse the PDF at runtime. |

---

## Important policy accuracy warning

The script ([`scripts/rural-data-001-initial-rural-rules-load.ts`](../../scripts/rural-data-001-initial-rural-rules-load.ts)) creates a **validated** `rural_rules` payload using the **same shape** as the Rural Checker **test fixtures**. That proves the system is **structurally** correct (schema, bindings, evaluator wiring) — **not** that numeric thresholds or scoring match the real **Rural Property Identification** policy.

**Before production:** confirm the published **`rural_rules`** payload (especially the **`evaluation`** block) **matches** the governed **Rural Definition / Rural Property Identification** PDF. **Do not** assume the fixture is policy-accurate **because** it validates.

---

## Why structured rules matter

The governed **Rural Property Identification** PDF may exist for humans and attribution, but **TICKET-008** requires **executable policy** from **`rural_rules.json_payload`** resolved via CONTENT-002. This ticket seeds that JSON so `/api/property/rural` can return `likely_*` outcomes when inputs are sufficient.

---

## Script

From the `t1f-tools` package root:

```bash
# Optional: path to Rural PDF (only used if no published rural_policy doc is found)
export RURAL_POLICY_PDF="$HOME/Downloads/Rural Property Identification.pdf"

npm run data:rural-001
```

- **`--dry-run`** — prints intent; validates PDF readability if file exists; **no** `DATABASE_URL` required.
- **Idempotency:** Skips creating a new `rural_rules` row if a **published** `rural_rules` already exists. Skips each binding if a **published** row already exists for `rural_checker` + that `binding_type`. Reuses an existing published **`rural_policy`** document when notes contain **`DATA-001 seed rural_policy`** or **`RURAL-DATA-001 seed rural_policy`**; otherwise uploads from `RURAL_POLICY_PDF` (default `~/Downloads/Rural Property Identification.pdf`).

---

## Initial `evaluation` payload

The script uses a validated **`evaluation`** block consistent with unit tests (`rural-evaluate.test.ts` / `rural.test.ts`). **Capital** should publish updated `rural_rules` via `/admin/rules` when policy changes; the seed is a starting point, not immutable law.

---

## Audit gate — required before full close

**Do not** mark **RURAL-DATA-001** as **fully closed** until the following are satisfied (use as an audit prompt or checklist):

1. **Policy alignment:** Walk the governed **Rural Property Identification** PDF and verify every material threshold, band, and scoring intent is reflected in the **published** `rural_rules` **`evaluation`** (or document explicit gaps and follow-up).
2. **Real data load:** Confirm `npm run data:rural-001` (or equivalent admin publish) has been run against the **intended** environment (staging/production), not only a local dev database.
3. **Hierarchy check:** Re-confirm **PDF = reference**, **`rural_rules` = runtime truth**, **Rural Checker = evaluator over JSON** — no reliance on “it validates” as proof of policy accuracy.

When the above are complete, update this doc’s **Status** to **closed (audit-verified)** and record the date under **Full closure**.

---

## Production safety

Same as **DATA-001:** point `DATABASE_URL` (and blob storage) only at the environment you intend. Running locally loads **your** dev database unless you explicitly use production credentials.

---

## Verification

- `/admin/rules`: published **`rural_rules`** with version label **RURAL-DATA-001 initial (structured evaluation)** (or skipped if one already existed).
- `/admin/bindings`: published **`rural_checker`** + **`rural_rules_rule_set`** and **`rural_checker`** + **`rural_policy_document`**.
- **`POST /api/property/rural`** with e.g. `{ "population": 40000 }` returns a scored result when rules resolve (not `insufficient_info` solely due to missing config).

---

## Full closure (not yet)

**RURAL-DATA-001** remains **open** for **audit** and **real data load** until the **§ Audit gate** is completed. After that, set status to **closed (audit-verified)** and note environment(s) and approver if your process requires it.

---

## Next major tool (product note)

**Credit Copilot** is the natural follow-on: the **credit policy** PDF can already live in the governed document system (**DATA-001**). Add the **`credit_copilot` + `credit_policy_document`** binding per **[`CREDIT-DATA-001`](./CREDIT-DATA-001.md)** before Copilot resolves policy via CONTENT-002; **Q&A / retrieval** design is still separate from this rural ticket.
