/**
 * Rep-facing tools must not surface raw SQL / driver errors. Detect common Postgres /
 * Drizzle failure shapes and substitute a short operational message; log full errors
 * server-side instead.
 */
const GENERIC_DB =
  "The screening service could not load its published configuration from the database. This is usually fixed by the operator: set DATABASE_URL, apply all database migrations from the repo, and publish the required tool bindings. See the project README; technical details are in server logs only.";

function looksLikeInternalDatabaseFailure(raw: string): boolean {
  const t = raw.toLowerCase();
  if (raw.includes("Failed query:")) {
    return true;
  }
  if (t.includes("econnrefused") || t.includes("etimedout") || t.includes("enotfound")) {
    return true;
  }
  if (
    (t.includes("relation ") || t.includes("table ")) &&
    t.includes("does not exist")
  ) {
    return true;
  }
  if (t.includes("permission denied for")) {
    return true;
  }
  if (t.includes("password authentication failed")) {
    return true;
  }
  if (t.includes("no pg_hba.conf entry")) {
    return true;
  }
  if (t.includes("ssl") && t.includes("certificate")) {
    return true;
  }
  return false;
}

/**
 * @param raw - `Error.message` from a catch block
 * @returns Safe string for JSON `error` fields or UI copy
 */
export function clientSafeDatabaseErrorMessage(raw: string): string {
  if (raw.includes("DATABASE_URL is not set")) {
    return raw;
  }
  if (looksLikeInternalDatabaseFailure(raw)) {
    return GENERIC_DB;
  }
  return raw;
}
