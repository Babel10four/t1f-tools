# First sprints (0–3)

**Status:** execution roadmap  
**Last updated:** 2026-04-15  

Concrete ticket lists and **Auditor exit** bars for the first four sprints. Aligns with the portfolio engines in [`portfolio-build-plan.md`](./portfolio-build-plan.md).

---

## Sprint 0 — Foundation

**Tickets:**

1. Tool shell UI  
2. Shared env / config loader  
3. Shared validation / types  
4. `/api/health`  
5. Docs folders + prompts + business rules seed  
6. Vercel preview deploy  
7. Feedback / error log mechanism  

**Auditor exit:** Deployed **preview**, **one working endpoint**, and **one working page**.

---

## Sprint 1 — Deal Engine core

**Tickets:**

1. Core deal schema  
2. `/api/deal/analyze`  
3. Loan Structuring Assistant UI  
4. Pricing Calculator surface  
5. Cash to Close surface  
6. Auditor pass with **5 historical scenario** tests  

**Auditor exit:** **Same backend powers three surfaces** consistently (structuring assistant, pricing calculator, cash to close).

---

## Sprint 2 — Deal Engine expansion

**Tickets:**

1. Term Sheet Generator **template system**  
2. **HTML → PDF** output  
3. **Pricing Comparison** tool  
4. **Shared scenario** persistence  
5. Audit against **edge cases** and **formatting**  

**Auditor exit:** Rep can go from **raw deal inputs** to a **usable internal term** output.

---

## Sprint 3 — Property Engine v1

**Tickets:**

1. **Property** schema  
2. `/api/property/rural`  
3. `/api/property/analyze`  
4. Rural Checker UI  
5. Market Analyzer UI  
6. Valuation Bot v1  

**Auditor exit:** **Address-level outputs** usable in **qualification**.

---

## Doc / code map

| Topic | Where |
|-------|--------|
| Rural and property business rules | `docs/business-rules/` |
| Term sheet / pricing reference material | `docs/business-rules/` |
| Deal analyze policy v1 (founder freeze) | [`docs/specs/TICKET-002.md`](./TICKET-002.md) |
| Assumptions doc polish (flag codes / copy) | [`docs/specs/DOC-002.md`](./DOC-002.md) |
| Loan Structuring Assistant UI (frozen) | [`docs/specs/loan-structuring-assistant-ui.md`](./loan-structuring-assistant-ui.md) |
| Cash to Close Estimator UI (frozen) | [`docs/specs/cash-to-close-estimator-ui.md`](./cash-to-close-estimator-ui.md) |
| Term Sheet Generator (BUILD SPEC) | [`docs/specs/TICKET-007.md`](./TICKET-007.md) — closed; [`term-sheet-generator-ui.md`](./term-sheet-generator-ui.md) is reference only |
| **Platform Path A** (auth, admin, content, config, analytics) | [`docs/specs/PLATFORM-PATH-A.md`](./PLATFORM-PATH-A.md) |
| ACCESS-001 · ADMIN-001 · CONTENT-001 · CONFIG-001 · ANALYTICS-001 · CONTENT-002 | See [`PLATFORM-PATH-A.md`](./PLATFORM-PATH-A.md) ticket table |
| Scout / Architect / Builder / Auditor prompts | `prompts/` |
