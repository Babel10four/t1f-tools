# BUILD SPEC — TICKET-006

**Status:** approved  
**Last updated:** 2026-04-17  
**Scout brief:** [`docs/briefs/TICKET-006.md`](../briefs/TICKET-006.md)  
**Branding:** Hub chrome and display names locked in **[`BRAND-001`](./BRAND-001.md)** (**Vanguard** + **Built by TheFoundry**); identity in **[`BRANDING-001`](./BRANDING-001.md)**. Historical mentions of **T1F Tools** in this spec refer to the same shell/hub.

---

## Objective

Refactor the **app shell** and **primary navigation** so **t1f.tools** behaves as an **internal tool hub** for tier-one reps working **live Bridge deal workflows**—not a generic loan portal or Next.js template.

- **No** engine changes, **no** API contract changes, **no** auth, persistence, PDFs, or external APIs.  
- **All existing live tool routes** keep working; **do not** delete routes to simplify IA.  
- **Prioritize discoverability and honesty** over visual polish; **no** design-system spike smuggled into this ticket.

---

## Route / file plan

| Route | Role after TICKET-006 |
|-------|------------------------|
| **`/`** | **Redirect** to **`/tools`** (see [Redirect behavior](#redirect-behavior-for-)). |
| **`/tools`** | **Primary hub page** — new **`src/app/tools/page.tsx`** (or equivalent) with sections: hero/start-here, Live Tools, Advanced, Coming Soon. |
| **`/tools/*`** (existing tools) | **Unchanged paths**; only **layout/shell/nav** and **hub** content change. |

**New or heavily modified files (expected)**

| File | Purpose |
|------|---------|
| `src/app/page.tsx` | Replace starter template with **redirect-only** (or minimal redirect wrapper). |
| `src/app/tools/page.tsx` | **New** — hub content (cards, sections, copy). |
| `src/app/tools/layout.tsx` | Refactor to **grouped nav** + branding aligned with hub; remove `/tools/pricing` from primary nav list. |
| `src/app/layout.tsx` | Update **default metadata** (title template, description) — remove Create Next App defaults. |
| Optional: `src/components/tools/*` | Small presentational pieces: `HubSection`, `LiveToolCard`, `ComingSoonRow`, `AdvancedToolLink` — **only if** layout stays readable without them. |

**Explicitly out of scope for file churn**

- `src/app/api/**`  
- `src/lib/engines/**`  
- Individual tool pages’ **business logic** (`loan-structuring-assistant-client`, etc.) — touch only if a **shared import path** or **layout wrapper** requires it.  

**Legacy / stub routes (policy)**

| Route | Policy |
|-------|--------|
| `/today`, `/loans`, `/properties`, `/inbox`, `/automations` | If present or added later: **must not** appear in **primary** hub nav or root shell nav. May remain **direct-link / bookmark** valid. **Current repo:** may have **zero** of these; policy still applies when introduced. |
| `/tools/pricing` | **Remain route-valid** if the file exists; **omit** from hub and from the **new** primary nav pattern in `tools/layout.tsx`. |

---

## Redirect behavior for `/`

- **Implementation:** Server Component at **`src/app/page.tsx`** using `redirect("/tools")` from **`next/navigation`** (App Router canonical pattern).  
- **Semantics:** **307** (or framework default for `redirect`) — users hitting **`/`** land on **`/tools`** immediately.  
- **No** client-only redirect required for v1 unless a measurable need appears.

---

## Shell / navigation rendering

- **`src/app/layout.tsx`** — Root HTML shell, fonts, globals; **default metadata** for whole app (see [Metadata plan](#metadata-plan)).  
- **`src/app/tools/layout.tsx`** — Wraps **all** routes under **`/tools`**, including **`/tools`** itself.  
  - Renders **persistent** header: product title **T1F Tools**, subtitle, and **grouped** navigation matching [IA](#nav-information-architecture).  
  - **Live** tool links: Loan Structuring Assistant, Pricing Calculator, Cash to Close Estimator.  
  - **Advanced:** Deal Analyzer (JSON harness) — visually **secondary** (smaller or grouped under “Advanced”).  
  - **Coming soon:** Term Sheet, Rural Checker, Market Analyzer, Voice Agent — **may** link to existing placeholder pages **or** be non-clickable with `href` disabled / `span` — **Builder choice**; must be **honest** (see [Hub](#hub-page-contents)).  
  - **Exclude** `/tools/pricing` from this nav.  
- **Non-`/tools` routes** (if any in the future): **no** duplicate full hub nav required in v1 unless product asks; legacy stubs stay **off** primary nav.

---

## Nav information architecture

**Labels (frozen)**

1. **Tool Hub** — links to **`/tools`** (current page when on hub).  
2. **Live Tools**  
   - Loan Structuring Assistant → `/tools/loan-structuring-assistant`  
   - Pricing Calculator → `/tools/pricing-calculator`  
   - Cash to Close Estimator → `/tools/cash-to-close-estimator`  
3. **Advanced**  
   - Deal Analyzer (JSON harness) → `/tools/deal-analyzer`  
4. **Coming soon**  
   - Term Sheet → `/tools/term-sheet`  
   - Rural Checker → `/tools/rural-checker`  
   - Market Analyzer → `/tools/market-analyzer`  
   - Voice Agent → `/tools/voice-agent`  

**Rules**

- **Do not** list `/tools/pricing` in hub or primary nav.  
- **Do not** list legacy stubs (`/today`, etc.) in primary nav.  
- **Deal Analyzer** must **not** sit in the **Live Tools** group; it stays under **Advanced**.

---

## Hub page contents (`/tools`)

1. **Hero / “start here”**  
   - Title: **T1F Tools** (or consistent with shell).  
   - Short subtitle: internal tool hub for **live Bridge deal workflows** (exact wording in implementation; match founder intent).  
   - One primary CTA: e.g. **Start with Loan Structuring Assistant** → `/tools/loan-structuring-assistant` (or the first live tool — **document** choice in code comment).

2. **Live Tools**  
   - **Three** entries as **clickable** cards or rows, each with:  
     - **Name**  
     - **One-line job description** (honest, workflow-oriented)  
     - **CTA** (e.g. “Open”)  

3. **Coming soon**  
   - Section heading explicitly **Coming soon** (or equivalent).  
   - Four items: **not** styled like shipped product cards; **non-clickable** or **muted** links with clear “coming soon” / “not available” copy.  
   - Must **not** look equivalent to Live Tools (layout, copy, or interaction).

4. **Advanced**  
   - **Single** secondary entry: **Deal Analyzer (JSON harness)** — smaller footprint, explanation that it is **raw JSON** / advanced.

5. **No** Create Next App / Vercel template boilerplate on the hub.

---

## Legacy route handling

- **No** primary navigation entries for `/today`, `/loans`, `/properties`, `/inbox`, `/automations`.  
- If those routes exist: **no** change required in TICKET-006 beyond **not** surfacing them; **no** requirement to delete them.

---

## Metadata plan

| Surface | `title` / `description` (directional) |
|---------|--------------------------------------|
| Root `layout.tsx` | Default title: **T1F Tools** (or `T1F Tools | …` template); description: internal Bridge deal tool hub — **not** “Create Next App”. |
| `tools/layout.tsx` or `tools/page.tsx` | Title/description for hub consistent with branding; **no** template defaults. |
| Individual tool pages | **Optional** in TICKET-006; **minimal** change only if required for consistent `title` template — **no** scope creep. |

---

## Component tree (minimal)

```text
RootLayout (app/layout.tsx)
└── body
    └── children

tools/layout.tsx
├── Header / shell
│   ├── Brand: T1F Tools + subtitle
│   └── Nav (grouped): Tool Hub | Live Tools | Advanced | Coming soon
└── {children}   ← tools/page.tsx (hub) or tool sub-pages

tools/page.tsx (hub)
├── Hero (start here)
├── LiveToolsSection
│   └── LiveToolCard × 3
├── ComingSoonSection
│   └── ComingSoonRow × 4 (non-interactive or clearly muted)
└── AdvancedSection
    └── DealAnalyzerRow (secondary)
```

Optional extracted components under `src/components/tools/` only if it reduces duplication with `layout.tsx`.

---

## Loading / empty / error implications

- **Hub and shell:** static content; **no** new data loading.  
- **Redirect `/`:** no loading spinner required; standard Next redirect.  
- **Coming soon pages:** if user navigates via bookmark to placeholder tool pages, existing behavior **unchanged**—no new error states required in TICKET-006.

---

## Manual QA scenarios

1. Visit **`/`** → lands on **`/tools`** hub.  
2. Hub shows **Live**, **Coming soon**, **Advanced** with correct copy hierarchy.  
3. All three **live** links work and match existing behavior.  
4. **Deal Analyzer** reachable from **Advanced**; **not** duplicated under Live.  
5. **`/tools/pricing`** not in hub or primary nav; **direct URL** still works if route exists.  
6. **No** “Create Next App” / template metadata on **View Source** / tab title for root and hub.  
7. Legacy routes (if any) **not** in nav.  
8. Mobile/narrow: nav remains usable (basic wrap/stack acceptable).  

---

## Definition of done

- [ ] **`/`** redirects to **`/tools`**.  
- [ ] **`/tools`** is the hub with **live**, **coming soon**, and **advanced** sections per spec.  
- [ ] Shell/nav uses **T1F Tools** branding and frozen IA; **`/tools/pricing`** omitted from primary nav/hub.  
- [ ] **Deal Analyzer** only under **Advanced**.  
- [ ] **Coming soon** clearly **not** equivalent to live tools.  
- [ ] Root metadata **not** template boilerplate.  
- [ ] **No** engine/API changes; **no** auth/persistence/PDFs/external APIs.  
- [ ] All existing live tool routes still work; **no** routes removed for navigation simplification.  
- [ ] Manual QA scenarios pass.

---

## Non-goals

Per-ticket feature work inside Loan Structuring / Pricing / Cash tools; redesign of those tool interiors; removing placeholder tool pages; design-system spike; pixel-perfect polish.
