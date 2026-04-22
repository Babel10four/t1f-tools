# BUILD SPEC — ACCESS-001

**Status:** approved  
**Last updated:** 2026-04-15  
**Parent:** [`PLATFORM-PATH-A.md`](./PLATFORM-PATH-A.md)

---

## Objective

Ship **app-level authentication** with **two shared passwords** and **two roles** (`user`, `admin`). **Do not** rely on **Vercel password protection** (or any deployment-only gate) as the primary security model.

---

## Behavior

- **Single login page** at **`/login`**, **one** password field.  
- Server compares plaintext (over HTTPS) against:  
  - **`SITE_PASSWORD_USER_HASH`** — bcrypt/argon2 hash of base user password  
  - **`SITE_PASSWORD_ADMIN_HASH`** — hash of admin password  
- On match, issue a **signed httpOnly cookie** (JWT) whose payload is minimal and includes:  
  - **`role`:** **`"user"`** or **`"admin"`**  
  - **`sid`:** opaque per-session identifier (e.g. UUID) for analytics and correlation — **not** a named user id; new `sid` on each successful login.  
- **Admin** may perform **everything** base users can, **plus** admin-only routes and APIs.

**Intentionally multiple concurrent users** can share the same password; no DB-backed identity in this ticket.

---

## Middleware / protection

| Pattern | Required role |
|---------|----------------|
| `/tools/**` | `user` **or** `admin` |
| `/admin/**` | `admin` only |
| Unauthenticated | Redirect to `/login` (except public routes + static assets) |

**Public:** `/login`, health checks as needed, static assets.

**Logout:** Clear cookie; optional `/logout` route.

---

## Out of scope

- Named user accounts, SSO, MFA (future).  
- Per-human audit attribution (see **PLATFORM-PATH-A** caveat).  

---

## Definition of done

- [ ] Env vars documented for **both** password hashes (generation instructions in README or ops doc).  
- [ ] Login works; cookie is **httpOnly**, **secure** in prod, **signed**.  
- [ ] Middleware enforces `/tools/**` and `/admin/**` as specified.  
- [ ] **No** reliance on Vercel deployment password for app security story.  
