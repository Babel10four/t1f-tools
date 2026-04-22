/** httpOnly cookie storing signed JWT with `role` + opaque `sid` (ACCESS-001 / ACCESS-001A). */
export const AUTH_COOKIE_NAME = "t1f_session";

/** HS256 signing key from env (min length enforced at verify time). */
export const AUTH_SECRET_ENV = "AUTH_SECRET";

export const SITE_PASSWORD_USER_HASH_ENV = "SITE_PASSWORD_USER_HASH";
export const SITE_PASSWORD_ADMIN_HASH_ENV = "SITE_PASSWORD_ADMIN_HASH";

/** Optional plaintext; checked before bcrypt (admin first). Escape `$` as `\\$` in `.env`. */
export const SITE_PASSWORD_USER_OVERRIDE_ENV = "SITE_PASSWORD_USER_OVERRIDE";
export const SITE_PASSWORD_ADMIN_OVERRIDE_ENV = "SITE_PASSWORD_ADMIN_OVERRIDE";

export type AuthRole = "user" | "admin";
