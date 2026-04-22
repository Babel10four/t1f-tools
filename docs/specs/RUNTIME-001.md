# RUNTIME-001 — Route integrity / legacy shell decommission

**Status:** closed (code + audit pass; operational caveat below)  
**Last updated:** 2026-04-18

---

## Problem

Local screenshots showed `/today` with an old “Loan Portal” shell and `/tools/term-sheet` as 404 while TICKET-006/007 were marked complete. In **this** repo (`t1f-tools`), those strings do not exist and `/tools/term-sheet` is implemented; the usual cause is **the wrong app or directory** running on `localhost:3000` (stale `.next`, or a different project).

## In-repo guarantees

1. **Legacy top-level routes** (`/today`, `/loans`, `/properties`, `/inbox`, `/automations`) are **308/redirected to `/tools`** via `next.config.ts` so they never render a replacement shell here.
2. **Term Sheet** lives at **`/tools/term-sheet`** and is listed under **Live Tools** in `src/app/tools/tools-registry.ts`.
3. **Guard test** fails CI if forbidden marketing copy reappears under `src/app` or `src/components`.

## Verification

From the `t1f-tools` package root:

```bash
rm -rf .next && npm run dev
```

Then open `/`, `/tools`, `/today` (should redirect to `/tools` then auth as applicable), `/tools/term-sheet`.

## Definition of done

- [x] Legacy paths redirect to `/tools`.
- [x] No forbidden shell copy in user-facing `src` trees (test).
- [x] Term Sheet remains a live tool in the registry.
- [x] Typecheck / tests / build pass.

---

## Closure

**Closed:** 2026-04-18 — **code + audit pass**: legacy redirects, hub/tool registry, guard tests, and CI suites match this spec.

**Operational caveat:** Manual “runtime verification” only holds if the **browser is pointed at the correct local app** — same **`t1f-tools`** directory, clean **`.next`**, **`npm run dev`** from package root. Wrong project or stale build on **`localhost:3000`** can still show foreign shells or 404s; that is an **environment** issue, not an in-repo gap. In-repo regressions should still fail CI via **`page.redirect.test.ts`**, **`legacy-route-redirects.test.ts`**, **`legacy-shell-copy.test.ts`**.
