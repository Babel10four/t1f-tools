# BUILD SPEC — TICKET-008

**Status:** closed (Rural Checker v1)  
**Last updated:** 2026-04-16  
**Scout brief:** [`docs/briefs/TICKET-008.md`](../briefs/TICKET-008.md)  
**Depends on:** [`CONTENT-002`](./CONTENT-002.md) resolver ([`resolveToolBinding`](../../src/lib/bindings/resolve.ts)), [`CONFIG-001`](./CONFIG-001.md) / [`validateRulePayload`](../../src/lib/rule-sets/validate-payload.ts) for **`rural_rules`**  
**Platform alignment:** [`PLATFORM-DATA-001`](./PLATFORM-DATA-001.md)

**Hard constraints:** No **`/api/deal/analyze`** changes; **no** deal engine (`src/lib/engines/deal/**`) changes; **no** runtime PDF parsing; **no** external APIs unless explicitly approved later; **no** geocoding in v1; **no** persistence; **no** broad Property Engine buildout. **Narrow exception:** session-gating for **`/api/property/**`** via [`middleware.ts`](../../src/middleware.ts) `matcher` (or a tiny access patch) if Builder confirms it is currently uncovered — see **§ Frozen decisions**.

---

## Frozen decisions (pre-Builder)

These are **fixed** for implementation; do not reinterpret without a spec revision.

### Route and API

| Item | Frozen value |
|------|----------------|
| **Tool UI route** | **`/tools/rural-checker`** |
| **Evaluation API** | **`POST /api/property/rural`** |

### Access — middleware (`/api/property/**`)

**Implemented:** [`src/middleware.ts`](../../src/middleware.ts) **`config.matcher`** includes **`/api/property`** and **`/api/property/:path*`** so **`POST /api/property/rural`** (and siblings) run through the same session gate as **`/tools/*`** — unauthenticated API callers receive **401** (existing pattern). If [README](../../README.md) still lists **`/api/property/**`** as ungated, update that line when convenient; the code path is authoritative.

### Resolver bindings (CONTENT-002)

| `tool_key` | `binding_type` | Resolves to | Runtime use |
|------------|----------------|-------------|-------------|
| `rural_checker` | **`rural_rules_rule_set`** | Published **`rule_sets`** with **`rule_type = rural_rules`** | **Required for evaluation** — scoring and outcomes come from validated `json_payload`. |
| `rural_checker` | **`rural_policy_document`** | Optional published **`documents`** row (**`rural_policy`**) | **Metadata only** — source/version/title for UI; **no** PDF bytes at runtime. |

### Runtime behavior (v1)

- **Evaluate** using **`rural_rules`** (published rule set payload), not the PDF.  
- **Display** optional **`rural_policy`**-linked metadata (labels/version/source attribution) only.  
- **Do not** parse the PDF at runtime.  
- **Do not** geocode or call **external address / Census / USDA** APIs in v1.  
- If there is **no usable published `rural_rules` binding** (missing / unconfigured / validation failure treated as unusable): return **`needs_review`** or **`insufficient_info`** with honest **`warnings`** — **never** a fabricated **`likely_rural`** / **`likely_not_rural`** “decision.”

---

## Objective

Ship **Rural Checker v1**: an **internal screening tool** (not legal/compliance determination) that:

1. Accepts **optional structured inputs** (no geocoding).  
2. Loads **published** `rural_rules` via **`resolveToolBinding("rural_checker", "rural_rules_rule_set")`**.  
3. Optionally surfaces **metadata** for the published **`rural_policy`** document via **`resolveToolBinding("rural_checker", "rural_policy_document")`** (titles/version labels only—**no** PDF bytes at runtime).  
4. Returns a **deterministic** result state + reasons + versioning metadata.

---

## 1. CONTENT-002 resolver contract (inspect)

**Function:** `resolveToolBinding(toolKey, bindingType)` → `resolved | missing | unconfigured` ([`src/lib/bindings/resolve.ts`](../../src/lib/bindings/resolve.ts)).

**Rural Checker bindings** — same as **§ Frozen decisions** (duplicate here for readers scanning §1 only).

| `tool_key` | `binding_type` | Target |
|------------|----------------|--------|
| `rural_checker` | `rural_rules_rule_set` | Published `rule_sets` row, `rule_type = rural_rules` |
| `rural_checker` | `rural_policy_document` | Optional published `documents` row, doc type **`rural_policy`** |

**Metadata helper:** `toResolvedMeta(resolved)` for id/versionLabel/title (no raw PDF).

---

## 2. `rural_rules` payload shape (v1 — extend CONFIG validation)

**Current** validated shape ([`RuralRulesPayload`](../../src/lib/rule-sets/validate-payload.ts)) is **only** `{ schemaVersion: 1, rules: [{ id, description?, threshold? }] }` — **insufficient** for input-based evaluation.

**TICKET-008 requires** an **additive, backward-compatible** extension (same `schemaVersion: 1`) **or** `schemaVersion: 2` — **pick one in implementation**; prefer **single version** for admin simplicity:

### Recommended `rural_rules` v1 evaluation block (frozen for TICKET-008)

```json
{
  "schemaVersion": 1,
  "evaluation": {
    "version": 1,
    "population": {
      "likelyRuralIfLte": 50000,
      "likelyNotRuralIfGte": 250000
    },
    "msa": {
      "likelyNotRuralIfTrue": true
    },
    "userRuralIndicator": {
      "likelyRuralIfTrue": true
    },
    "scores": {
      "likelyRuralMin": 2,
      "likelyNotRuralMax": -1,
      "needsReviewBandMin": -1,
      "needsReviewBandMax": 1
    }
  },
  "rules": []
}
```

- **`rules`** may remain **empty** in v1 if all logic lives in **`evaluation`**; or keep **`rules`** for audit labels only.  
- **CONFIG-001:** extend **`validateRulePayload("rural_rules", …)`** to accept **`evaluation`** (required object with `version: 1`) and preserve existing **`rules[]`** validation.

**Architect decision:** If extension is too large for one PR, split **CONFIG-001a** (schema + validation) before **TICKET-008** UI.

---

## 3. Request contract — `POST /api/property/rural`

**Content-Type:** `application/json`

**Body (v1)**

| Field | Type | Required |
|--------|------|----------|
| `addressLabel` | string | No |
| `state` | string (2-letter or full — **document** normalization rules) | No |
| `county` | string | No |
| `municipality` | string | No |
| `population` | number | No |
| `isInMsa` | boolean | No |
| `userProvidedRuralIndicator` | boolean | No |
| `notes` | string | No — **server may ignore** or echo only in analytics metadata (not in v1 response) |

**At least one** of `population`, `isInMsa`, `userProvidedRuralIndicator`, `state`, `county`, `municipality` **should** be present for meaningful output; if **none** provided → **`insufficient_info`** (see §6).

**No** new top-level keys beyond this list in v1 without spec revision.

---

## 4. Response contract — `POST /api/property/rural`

**HTTP 200** — JSON:

| Field | Type | Notes |
|--------|------|--------|
| `result` | enum | `likely_rural` \| `likely_not_rural` \| `insufficient_info` \| `needs_review` |
| `certainty` | enum | `low` \| `medium` \| `high` — **screening confidence**, not legal certainty |
| `reasons` | string[] | Human-readable, **deterministic** from evaluation + inputs |
| `warnings` | string[] | e.g. missing config, sparse inputs |
| `ruleSet` | object \| null | `{ id, versionLabel, ruleType: "rural_rules" }` from resolver meta |
| `ruralPolicy` | object \| null | `{ id, title, versionLabel }` from document meta when binding resolves |
| `disclaimer` | string | Static **non-final determination** copy (server-side constant) |

**Do not** include language: “approved,” “guaranteed rural,” “final determination,” “legal,” “compliance.”

**HTTP 4xx/5xx:** reuse existing engine error patterns if shared; **no** deal-analyze envelope required unless you unify—**minimal** JSON error `{ error, code? }` acceptable for v1.

---

## 5. Server-side rule evaluation (deterministic)

**Inputs:** parsed request + `evaluation` object from validated `json_payload` of published `rural_rules`.

**Suggested scoring (v1 — adjust to match `evaluation` schema):**

1. Compute **integer score** starting at `0`.  
2. If `population` provided: if `≤ likelyRuralIfLte` → `+2`; if `≥ likelyNotRuralIfGte` → `-2` (or values from config).  
3. If `isInMsa === true` and `msa.likelyNotRuralIfTrue` → apply penalty.  
4. If `userProvidedRuralIndicator === true` → apply `userRuralIndicator` rule.  
5. Map score + input completeness to **`result`**:  
   - `likely_rural` if score ≥ `scores.likelyRuralMin`  
   - `likely_not_rural` if score ≤ `scores.likelyNotRuralMax`  
   - `needs_review` if in band `[needsReviewBandMin, needsReviewBandMax]` or conflicting signals  
   - `insufficient_info` if **no** usable inputs or **no** `evaluation` block

**Reasons:** Append **one string per applied rule signal** (id + label from config optional).

---

## 6. Missing-config fallback

| Condition | Behavior |
|-----------|----------|
| `resolveToolBinding` → **missing** / **unconfigured** | `result: insufficient_info` or `needs_review`; **`warnings`** include “Published rural rules not configured”; **`ruleSet: null`**; **no** fabricated scores |
| Resolved ruleset but **payload validation fails** | **500** or treat as unconfigured — **document** choice; prefer **500** with safe message for admin visibility |

**Never** silently use hardcoded USDA logic; **never** read PDF. **Never** return **`likely_rural`** or **`likely_not_rural`** when there is **no usable published `rural_rules`** — only **`needs_review`** or **`insufficient_info`** (aligned with **§ Frozen decisions**).

---

## 7. Published `rural_policy` metadata

- Resolve **`rural_policy_document`** binding.  
- On success, fill **`ruralPolicy`** with **`id`, `title`, `versionLabel`** from `documents` row (via `toResolvedMeta` or equivalent).  
- **Do not** fetch PDF from storage; **do not** parse text.

---

## 8. UI input model (`/tools/rural-checker`)

- **Mirror** API fields: optional text inputs + toggles + optional `population` number.  
- **Local-only:** optional notes field **not sent** in v1 **or** sent only in analytics metadata — **pick one**; default **omit from POST body** to keep API minimal.  
- **Primary CTA:** “Run screening” / “Check”  
- **Display:** response **`result`**, **`certainty`**, **`reasons`**, **`warnings`**, **`ruleSet` / `ruralPolicy`** labels, **`disclaimer`**.

---

## 9. Output states (frozen)

| `result` | Meaning |
|----------|---------|
| `likely_rural` | Signals lean rural under published rules |
| `likely_not_rural` | Signals lean non-rural |
| `insufficient_info` | Not enough inputs and/or no config |
| `needs_review` | Conflicting or borderline — human review |

---

## 10. Analytics

**Event type:** `rural_check_run` (already wired on [`/api/property/rural`](../../src/app/api/property/rural/route.ts) via `handleEnginePost`).

**Metadata (optional):** `{ result, hasRuleSet: boolean }` — **no** PII; **no** full address in metadata if policy forbids.

---

## 11. Affected modules

| Module | Change |
|--------|--------|
| `src/lib/engines/property/rural.ts` | Replace stub with resolver + evaluation + response |
| `src/lib/rule-sets/validate-payload.ts` | Extend **`rural_rules`** schema |
| `src/app/tools/rural-checker/page.tsx` | Full client UI |
| `src/app/api/property/rural/route.ts` | Possibly switch to dedicated handler if `handleEnginePost` signature mismatches — keep **analytics** `rural_check_run` |

**Unchanged:** `src/lib/engines/deal/**`, `/api/deal/analyze/**`

---

## 12. Hub / nav impact (TICKET-006 / hub)

- Move **Rural Checker** from **Coming soon** to **Live Tools** with copy: **internal screening** (not final determination).  
- Update **`docs/specs/TICKET-006`** hub lists or **`/tools` page** when TICKET-008 merges.

---

## 13. Test plan

- **Unit:** scoring function with fixed `evaluation` + input fixtures.  
- **Integration:** mock `resolveToolBinding` — resolved vs missing.  
- **Contract:** request/response JSON shapes.  
- **Manual QA:** no inputs → `insufficient_info`; full inputs + published config → `likely_*`; missing binding → warning + fallback.

---

## 14. Manual QA scenarios

1. Published **`rural_rules`** + population only → deterministic result + reasons.  
2. No binding → `insufficient_info` / warnings, no crash.  
3. **`rural_policy`** binding resolves → metadata appears.  
4. UI **does not** claim legal/compliance finality.  
5. **`/api/deal/analyze`** unchanged (smoke).  
6. Analytics event fires on POST.

---

## 15. Definition of done

- [x] **Access:** **`/api/property/**`** session-gated via **`middleware.ts`** `matcher` — see **§ Frozen decisions** and **§ Closure**.  
- [x] **`POST /api/property/rural`** implements evaluation + response contract; **stub removed**.  
- [x] **`validateRulePayload`** accepts **TICKET-008** `evaluation` block; admin can publish **`rural_rules`**.  
- [x] **CONTENT-002** resolver used for **`rural_checker`** + **`rural_rules_rule_set`** (and optional **`rural_policy_document`**).  
- [x] **`/tools/rural-checker`** UI complete; **no** PDFs, **no** external APIs in v1.  
- [x] **Result** + **`certainty`** + **`reasons`** + **`warnings`** + versioning fields **no** legal-final language.  
- [x] **Hub** promotes Rural Checker to **Live Tools**.  
- [x] Tests + manual QA pass.  
- [x] **Deal engine** and **`/api/deal/analyze`** — **no** diffs required.

---

## 16. Non-goals

Geocoding, Census API, USDA API, PDF OCR, vector search, full Property Engine, user accounts, saving searches.

---

## Closure

**Closed:** 2026-04-16 — **Rural Checker v1** complete (route **`/tools/rural-checker`**, API **`POST /api/property/rural`**, deterministic evaluator, CONTENT-002 bindings, no runtime PDF parsing). **Policy seeding and production accuracy** for published **`rural_rules`** are tracked under **[`RURAL-DATA-001`](./RURAL-DATA-001.md)** (implemented; audit / real data load still pending).
