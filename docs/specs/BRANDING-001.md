# BRANDING-001 — System branding (locked)

**Status:** locked  
**Last updated:** 2026-04-16  

---

## Frozen identity

| Dimension | Value |
|-----------|--------|
| **System** | **Vanguard** |
| **Brand owner** | **TheFoundry** |
| **Product expression** (long-form / contracts) | **Vanguard by TheFoundry** |
| **Primary audience** | **AE / tier-one funding team** |

---

## Usage rules

- **Hub / shell chrome** (see **[`BRAND-001`](./BRAND-001.md)**): primary line **Vanguard** (`HUB_SYSTEM_NAME`), secondary **Built by TheFoundry** (`HUB_BUILT_BY_LINE`), then audience tagline — not the repository or package name (`t1f-tools`).
- **`PRODUCT_EXPRESSION`** remains for long-form references; browser `<title>` defaults to **`HUB_SYSTEM_NAME`** per BRAND-001.
- **Audience** informs copy tone and hub descriptions.

Implementation constants live in [`src/lib/branding.ts`](../../src/lib/branding.ts).

---

## Definition of done

- [x] Spec locks the dimensions above.  
- [x] Shell, login, and metadata aligned with **BRAND-001** (split header + tagline).  
