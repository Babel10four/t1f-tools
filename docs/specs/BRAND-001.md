# BUILD SPEC — BRAND-001 — Vanguard by TheFoundry naming refresh

**Status:** approved (reference — core implementation complete)  
**Last updated:** 2026-04-22  
**Identity lock:** [`BRANDING-001`](./BRANDING-001.md)  
**Hub structure:** extends [`TICKET-006`](./TICKET-006.md) (registry pattern; routes frozen)

---

## Objective

Refresh **hub, navigation, metadata, and tool display names** to the **Vanguard** naming system:

- **System name:** **Vanguard**  
- **Brand line:** **Built by TheFoundry**  
- Long-form / contracts: **Vanguard by TheFoundry** (see BRANDING-001)

Tool names remain **functional labels** — **do not** prefix every tool with “Vanguard.”

**This ticket does not change URLs.** All **`/tools/*`** paths stay as-is unless a future ticket adds explicit redirects.

---

## Hard constraints

| # | Constraint |
|---|------------|
| 1 | No engine / policy code changes. |
| 2 | No API contract or route handler signature changes. |
| 3 | No route removals. |
| 4 | No route renames; no path changes unless a separate ticket adds redirects. |
| 5 | No auth, admin shell, or data-layer changes (ACCESS-001 / ADMIN-001 stay separate). |
| 6 | Keep existing tests green; update assertions only for intentional copy/registry changes. |

---

## Branding decisions (frozen)

| Item | Value |
|------|--------|
| System | **Vanguard** |
| Attribution line (hub chrome) | **Built by TheFoundry** |
| Product expression (long-form) | **Vanguard by TheFoundry** |
| Tool naming | Clear functional labels; **no** `Vanguard — …` prefix on each tool |

Constants: [`src/lib/branding.ts`](../../src/lib/branding.ts) (`HUB_SYSTEM_NAME`, `HUB_BUILT_BY_LINE`, `PRODUCT_EXPRESSION`, `PRODUCT_TAGLINE`).

---

## Display-name mapping (routes frozen)

Replace **legacy labels** in UI/registry only; **`href` unchanged.**

| Route | Display name |
|-------|----------------|
| `/tools/loan-structuring-assistant` | **Deal Structuring Copilot** |
| `/tools/term-sheet` | **Deal Sheet Builder** |
| `/tools/cash-to-close-estimator` | **Cash to Close Calculator** |
| `/tools/pricing-calculator` | **Loan Pricing Engine** |
| `/tools/rural-checker` | **Rural Eligibility Checker** |
| `/tools/credit-copilot` | **Credit Copilot** (placeholder until shipped) |

### Future / placeholder display names (stubs)

| Legacy / working name | Target display name |
|----------------------|---------------------|
| Disclosures generator | **Disclosure Builder** |
| Pricing comparison tool | **Pricing Comparator** |
| Market researcher | **Market Intel** |
| Prospect Researcher | **Prospect Intel** |
| Interactive voice agent | **Voice Operator** |

Stub `href`s remain as today (e.g. `/tools/disclosure-builder`, `/tools/pricing-comparator`, …) until those routes exist or are added under other tickets.

---

## Hub group labels (canonical)

| Group | Purpose |
|-------|---------|
| **Execution Layer** | Shipped deal workflow tools + staged execution placeholders (comparator, disclosure). |
| **Intel Layer** | Research / intel placeholders (Market Intel, Prospect Intel, Voice Operator). |
| **Decision Layer** | Policy / credit (Credit Copilot placeholder). |
| **Advanced / Internal** | JSON harnesses and engineer-oriented tools (e.g. Deal Analyzer). |

**Implementation note:** Hub page headings and `TOOLS_NAV_SECTIONS` should use **Advanced / Internal** for the final group. If any screen still shows **Advanced** alone, treat as a **copy-only** alignment to this spec (no route changes).

---

## Route / file plan

| Area | Files (typical) |
|------|-----------------|
| Registry | [`src/app/tools/tools-registry.ts`](../../src/app/tools/tools-registry.ts) — labels, descriptions, section titles, layer sequences. |
| Hub page | [`src/app/tools/page.tsx`](../../src/app/tools/page.tsx) — section `<h2>` copy, intro blurbs, grid (if not fully driven by registry). |
| Shell / nav | [`src/components/tools/tools-nav.tsx`](../../src/components/tools/tools-nav.tsx), [`src/app/tools/layout.tsx`](../../src/app/tools/layout.tsx); admin shell [`src/app/admin/admin-shell.tsx`](../../src/app/admin/admin-shell.tsx) — product title lines from branding constants. |
| Branding | [`src/lib/branding.ts`](../../src/lib/branding.ts) — system name, built-by line, `PRODUCT_EXPRESSION`, tagline. |
| Per-tool pages | Each `src/app/tools/<route>/page.tsx` — `metadata.title` / `description` and on-page `<h1>` aligned with registry display names (routes unchanged). |
| Root / login | [`src/app/layout.tsx`](../../src/app/layout.tsx) (title template), [`src/app/login/page.tsx`](../../src/app/login/page.tsx) — optional Vanguard attribution. |
| Tests | [`src/app/tools/tools-registry.test.ts`](../../src/app/tools/tools-registry.test.ts) and any tests asserting old strings. |

**Out of scope here:** `package.json` name, repo slug, analytics `tool_key` strings, HTTP header names (e.g. `X-T1F-Tool-Key`) — change only in dedicated tickets if required.

---

## Registry update plan

1. **`LIVE_TOOLS`** — set `label` (and optionally `description`) per mapping above; **do not** change `href`.
2. **`EXECUTION_LAYER_SEQUENCE`** — order preserved; placeholders use `PRICING_COMPARATOR_PLACEHOLDER`, `DISCLOSURE_BUILDER_PLACEHOLDER` with target labels.
3. **`INTEL_PLACEHOLDER_TOOLS`**, **`CREDIT_COPILOT_PLACEHOLDER`** — labels per mapping.
4. **`ADVANCED_TOOLS`** — display name for Deal Analyzer may stay verbose (`Deal Analyzer (JSON harness)`) or shorten per product copy; **href** fixed.
5. **`TOOLS_NAV_SECTIONS`** — `title` strings for hub / execution / intel / decision / **Advanced / Internal**.
6. **`HUB_PRIMARY_CTA_HREF`** — still first execution live tool (`/tools/loan-structuring-assistant`); CTA text uses first tool’s **`label`**.

---

## Copy changes (checklist)

- [ ] Shell: primary **Vanguard**, secondary **Built by TheFoundry** (not a single legacy “T1F Tools” product string in user-facing chrome).
- [ ] Hub intro and CTA: use registry labels (“Start with {Deal Structuring Copilot}”).
- [ ] Layer section headings: Execution / Intel / Decision / **Advanced / Internal**.
- [ ] Tool cards and nav pills: registry `label` only.
- [ ] Per-tool `metadata.title` / page `<h1>`: match display names (no URL change).

---

## Metadata changes (checklist)

- [ ] Root layout title template → default includes **Vanguard** (via `HUB_SYSTEM_NAME` or template in `layout.tsx`).
- [ ] `/tools` hub: `metadata.title` / `description` from `PRODUCT_TAGLINE` or aligned strings.
- [ ] Each live tool route: `export const metadata` uses new display name in `title` / `description` where user-visible.

---

## Tests

| Test | Expectation |
|------|-------------|
| `tools-registry.test.ts` | Live tool **hrefs** unchanged; **labels** match BRAND-001 mapping; nav section ids stable. |
| Component tests | Any `getByText` / snapshot using old names updated to new display strings. |
| Full suite | `npm test` passes after copy-only edits. |

No new contract tests for APIs.

---

## Definition of done

- [ ] User-visible product identity matches **Vanguard** + **Built by TheFoundry**; long-form **Vanguard by TheFoundry** available where BRANDING-001 requires it.
- [ ] Hub groups labeled: **Execution Layer**, **Intel Layer**, **Decision Layer**, **Advanced / Internal**.
- [ ] All mapped tool **display names** live in registry and propagate to hub, nav, and tool pages.
- [ ] **No** `href` or API changes; **no** engine changes.
- [ ] **All tests pass**; registry tests updated for new labels.
- [ ] This spec and [`BRANDING-001`](./BRANDING-001.md) remain aligned.

---

## Non-goals

- URL rewrites, redirects, or aliases.  
- Renaming analytics keys, Blob paths, or external integration IDs.  
- Visual redesign beyond copy and minimal heading updates.

---

## Closure

**Core naming + registry:** implemented in-repo (see `tools-registry.ts`, `branding.ts`, hub layout). **Optional:** align last hub heading **Advanced** → **Advanced / Internal** if any copy still reads “Advanced” only.
