# BUILD SPEC — ADMIN-001

**Status:** approved  
**Last updated:** 2026-04-18  
**Depends on:** [`ACCESS-001`](./ACCESS-001.md)  
**Parent:** [`PLATFORM-PATH-A.md`](./PLATFORM-PATH-A.md)

---

## Objective

Provide an **admin shell**: layout, navigation, and placeholder routes for **uploads, config, and analytics** — wired to **`admin` role only** — so **`CONTENT-001`**, **`CONFIG-001`**, and **`ANALYTICS-001`** can attach real UI without re-plumbing routes.

---

## Routes (minimum)

| Route | Purpose |
|-------|---------|
| `/admin` | Redirect to `/admin/dashboard` or hub |
| `/admin/dashboard` | KPI shell (populate in **ANALYTICS-001**) |
| `/admin/documents` | Shell for **CONTENT-001** |
| `/admin/rules` | Shell for **CONFIG-001** (label “Rule Sets & Rates” in nav) |
| `/admin/publish-history` | Shell for publish audit trail |

**Admin users** see **full base user navigation** (Tool Hub, Deal Workbench tools, Advanced) **plus** admin-only nav items.

---

## UI rules

- Clear visual distinction that admin section is **elevated**.  
- All `/admin/**` pages **server- or middleware-protected** as `admin` only (per **ACCESS-001**).  

---

## Definition of done

- [ ] Admin layout + nav with links above.  
- [ ] Non-admin cannot access `/admin/**` (403 or redirect).  
- [ ] Placeholder content acceptable where downstream tickets fill features.  
