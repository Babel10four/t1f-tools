# BUILD SPEC — TICKET-009 — Credit Copilot v1

**Status:** closed  
**Last updated:** 2026-04-15  
**Scout brief:** [`docs/briefs/TICKET-009.md`](../briefs/TICKET-009.md)  
**Product context:** **Vanguard by TheFoundry** — UI display name **Credit Copilot** (see [`BRAND-001`](./BRAND-001.md) if present).  
**Depends on:** [`CONTENT-002`](./CONTENT-002.md) resolver, [`CONTENT-001`](./CONTENT-001.md) documents (`extracted_text`), [`ANALYTICS-001`](./ANALYTICS-001.md)  
**Aligns with:** [`PLATFORM-DATA-001`](./PLATFORM-DATA-001.md) (published bindings only)

**Hard constraints:** Use **CONTENT-002** resolver; **`tool_key = credit_copilot`**; **`binding_type = credit_policy_document`**; **no** latest-created fallback; **no** draft/archived documents as sources; **no** final underwriting / approval / decline language; **no** borrower-facing language; **no** voice v1; **no** credit pulls; **no** external data APIs; **no** borrower PII storage; **no** raw policy text in analytics; **no** chat persistence in v1 unless explicitly approved; **no** runtime PDF parsing; **no** changes to deal-engine or property-engine **contracts**.

---

## Objective

Ship **Credit Copilot v1**: **text-first** internal Q&A so tier-one reps can ask nuanced credit-policy questions and receive **grounded, cautious** answers from the **currently published** Credit Policy document—via **`extracted_text`**, deterministic chunking/retrieval, and a **closed-book** model prompt (no reliance on parametric knowledge outside retrieved context).

---

## Route / file plan

| Artifact | Path |
|----------|------|
| UI | `src/app/tools/credit-copilot/page.tsx` — server shell + `CreditCopilotClient` or single client page |
| Client | `src/app/tools/credit-copilot/credit-copilot-client.tsx` — question form, answer panel, citations, disclaimer |
| API | `src/app/api/credit-copilot/ask/route.ts` — `POST` handler |
| Server logic | `src/lib/credit-copilot/` (recommended): `resolvePolicy.ts`, `chunkPolicy.ts`, `retrieve.ts`, `buildPrompt.ts`, `redact.ts`, `types.ts` |
| Tests | `src/lib/credit-copilot/*.test.ts`, optional `src/app/api/credit-copilot/ask/route.test.ts` |

**Do not modify:** `src/lib/engines/deal/**`, `src/app/api/deal/**`, property engine public contracts (except shared imports if absolutely necessary — avoid).

---

## API contract — `POST /api/credit-copilot/ask`

**Auth:** Session required — same gate as **`/tools/*`** and **`/api/credit-copilot/**`** ([`middleware.ts`](../../src/middleware.ts) matcher already includes **`/api/credit-copilot`**). Unauthenticated → **401** JSON.

**Request body (JSON)**

| Field | Type | Required |
|--------|------|----------|
| `question` | string | Yes — non-empty after trim |
| `clientCorrelationId` | string | No — echo in response optional for debugging |

**Forbidden in body:** structured borrower PII, credit bureau payloads, file-level decisioning fields, uploads.

**Response body (JSON)** — v1

| Field | Type | Notes |
|--------|------|--------|
| `status` | enum | See [Status enum](#status-enum) |
| `answer` | string | Empty when status ≠ `answered` (or short safe message per status) |
| `citations` | array | `{ label?: string; excerpt: string }[]` — short excerpts only |
| `sourceDocument` | object \| null | `{ id, title, versionLabel, publishedAt?: string }` |
| `warnings` | string[] | e.g. thin corpus, redaction applied |
| `disclaimer` | string | Static + internal-use framing |

### Status enum

| Value | When |
|-------|------|
| `answered` | Model produced an answer from retrieved chunks |
| `policy_unavailable` | Resolver missing/unconfigured **or** no published document |
| `insufficient_policy_context` | Resolved doc but **`extracted_text`** empty/too short **or** retrieval finds no relevant chunks |
| `refused_sensitive_or_decision_request` | Decision/approval language or sensitive pattern detected |
| `error` | Unexpected server failure |

**Fail closed:** On `policy_unavailable` / `insufficient_policy_context`, **do not** answer from general model knowledge.

---

## Resolver usage

**Exact call:** `resolveToolBinding("credit_copilot", "credit_policy_document")` ([`src/lib/bindings/resolve.ts`](../../src/lib/bindings/resolve.ts)).

**Rules**

- **Only** **`state === "resolved"`** and **`kind === "document"`** → load **`documents`** row by id from resolver output.  
- Target must be **published** `credit_policy` (enforced by [`documentMatchesBindingType`](../../src/lib/bindings/target-validation.ts)).  
- **Forbidden:** `ORDER BY created_at` heuristics, draft/archived rows, binding bypass.

**Text source:** `document.extractedText` (DB column `extracted_text`). **No** PDF byte read in request path.

---

## Retrieval / chunking design (v1)

1. **Input:** `extractedText` string (may be large).  
2. **Chunking — deterministic:** e.g. split on `\n\n` with max chunk char length + overlap rules **fixed in code** (same input → same chunks — **unit test**).  
3. **Retrieval — v1:** **Keyword / token overlap** scoring (TF-lite or simple bag-of-words) — **no** vector DB required for v1; **deterministic** ranking.  
4. **Top-k:** e.g. `k = 5` chunks — constant in code.  
5. **If** no chunk scores above minimal threshold → **`insufficient_policy_context`**.  
6. **Prompt:** System + user messages must instruct: answer **only** from provided chunks; if chunks insufficient, say so (**insufficient_policy_context** path).

**No** runtime PDF parsing; **no** loading `storage_key` for read during ask.

---

## Prompt / answer rules

1. **Cautious** tone; internal guidance only.  
2. State **what the policy text supports**; state **what is unclear or silent**.  
3. **Escalation** when ambiguous or when question asks for a decision.  
4. **Citations:** chunk labels (e.g. “Section chunk 3”) + **short** excerpt (length cap).  
5. **Never:** approved, declined, guaranteed, final, committed, borrower promise.  
6. **Refusal:** If user asks approve/decline/guarantee → **`refused_sensitive_or_decision_request`** with safe **`answer`** explaining limitation.

---

## PII / privacy rules

**UI**

- Visible warning: do **not** enter SSN, DOB, full borrower names, file numbers, full sensitive deal details.

**Server (v1)**

- Optional **pattern redaction** on `question` before logging/model (SSN-like, long digit runs) — **best-effort**; document limits.  
- **Never** persist raw question text in analytics.

**Analytics**

- Event: **`credit_copilot_question`** ([`constants.ts`](../../src/lib/analytics/constants.ts)).  
- **Metadata allowed:** `status`, `hasPolicyBinding`, `sourceDocumentId` (or version id), `citationCount`, `questionLength` (number only).  
- **Forbidden:** raw question, raw answer, raw policy text, borrower PII.

---

## Analytics plan

| Field | Include |
|--------|---------|
| `event_type` | `credit_copilot_question` |
| `tool_key` | `credit_copilot` |
| `status` | Response status |
| `metadata` | Safe fields only — see above |

**Emit only from:** `POST /api/credit-copilot/ask` — not from `/api/voice/session` or other routes (**TICKET-009A**).

---

## UI component tree

```text
CreditCopilotPage
├── Header — “Credit Copilot” + internal-only subtitle
├── PiiWarningBanner
├── QuestionForm
│   ├── textarea (question)
│   └── Submit
├── LoadingState
├── AnswerPanel (status === answered)
├── StatusPanel (policy_unavailable | insufficient | refused | error)
├── CitationsPanel
├── SourceVersionPanel (sourceDocument)
└── DisclaimerFooter
```

**Empty states:** No answer until first success; **unavailable** messaging when API returns `policy_unavailable`.

---

## Error / failure states

| Condition | HTTP | `status` |
|-----------|------|----------|
| No session | 401 | — |
| Resolver missing | 200 | `policy_unavailable` |
| `extractedText` null/empty | 200 | `insufficient_policy_context` |
| Sensitive / decision ask | 200 | `refused_sensitive_or_decision_request` |
| LLM / internal error | 500 | `error` (or 500 body with message) |

**Do not** return fabricated citations.

---

## Test plan

- **Binding missing** → `policy_unavailable`, **no** grounded answer from model-only path.  
- **Draft/archived** doc never selected (resolver + DB query tests / mock).  
- **Published + extracted text** → `answered` with citations from chunks.  
- **Approval question** → `refused_sensitive_or_decision_request` or safe reframe per policy.  
- **Off-policy topic** → uncertainty / `insufficient_policy_context`.  
- **Analytics** payload contains **no** raw question (inspect `enqueuePlatformEvent` mock).  
- **Middleware:** unauthenticated `POST` → **401**.  
- **No** PDF read in handler (mock fs/storage).  
- **Build / typecheck / tests** green.

---

## Definition of done

- [x] **`/tools/credit-copilot`** implements UI per [UI component tree](#ui-component-tree). — **UI tested**  
- [x] **`POST /api/credit-copilot/ask`** implements [API contract](#api-contract--post-apicredit-copilotask). — **Ask route tested**  
- [x] Resolver + **`extracted_text`** only; **no** request-time PDF.  
- [x] **Fail closed** when binding/text missing.  
- [x] **Status** enum + **disclaimer** + **citations** + **`sourceDocument`**.  
- [x] **Analytics** — `credit_copilot_question` with **safe** metadata only, emitted **only** from `POST /api/credit-copilot/ask` — **analytics taxonomy fixed by TICKET-009A** (voice no longer uses Credit Copilot taxonomy).  
- [x] **Auth** — `/tools/credit-copilot` and `/api/credit-copilot/**` gated (middleware verified). — **Auth verified**  
- [x] **No** deal/property engine contract changes.  
- [x] Tests + manual QA scenarios pass; **build / typecheck / tests passing**.  
- [ ] Hub copy updated: Credit Copilot **live** when shipped (if applicable).  
- [x] Published **`credit_copilot`** + **`credit_policy_document`** binding exists — **[`CREDIT-DATA-001`](./CREDIT-DATA-001.md)** / **`/admin/bindings`** — **binding confirmed**

---

## Non-goals (v1)

Voice, saved chat, credit bureau integration, external LLM vendor lock-in documentation, vector DB, borrower portal, PDF export.

---

## TICKET-009A — Voice analytics scope cleanup (narrow patch)

**Status:** closed  
**Last updated:** 2026-04-15  

**Issue (audit P1):** `POST /api/voice/session` logged `eventType: credit_copilot_question` and `toolKey: credit_copilot`, polluting Credit Copilot analytics and breaking scope discipline (voice is out of scope for Credit Copilot v1).

**Resolution**

| Route | `event_type` | `tool_key` |
|-------|----------------|------------|
| `POST /api/credit-copilot/ask` | `credit_copilot_question` | `credit_copilot` |
| `POST /api/voice/session` | `voice_session_run` | `voice_operator` |

**Constraints preserved:** No retrieval, API contract, UI, engine, or voice-in-Copilot changes beyond analytics taxonomy + safe error metadata on shared `handleEnginePost` 500 paths (`code: INTERNAL` instead of internal message snippets).

**Tests:** `src/app/api/voice/session/route.test.ts`, `src/app/api/credit-copilot/ask/route.test.ts` assert the above.
