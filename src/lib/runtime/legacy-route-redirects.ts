/**
 * RUNTIME-001 — legacy loan-portal-style paths must not serve a user-facing shell.
 * Redirect to the tools hub before middleware/auth runs on `/tools`.
 *
 * @see docs/specs/RUNTIME-001.md
 */

/** Paths that previously hosted the old shell; subpaths included. */
export const LEGACY_SHELL_PATH_PREFIXES = [
  "/today",
  "/loans",
  "/properties",
  "/inbox",
  "/automations",
] as const;

export type NextRedirect = {
  source: string;
  destination: string;
  permanent: boolean;
};

/**
 * Next.js `redirects()` entries: exact path + `:path*` so `/loans/123` also decommissions.
 */
export function getLegacyShellRedirects(): NextRedirect[] {
  const out: NextRedirect[] = [];
  for (const prefix of LEGACY_SHELL_PATH_PREFIXES) {
    out.push({
      source: prefix,
      destination: "/tools",
      permanent: false,
    });
    out.push({
      source: `${prefix}/:path*`,
      destination: "/tools",
      permanent: false,
    });
  }
  return out;
}
