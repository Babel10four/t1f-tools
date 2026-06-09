/**
 * Minimal class-name joiner. Filters falsy values so callers can use
 * `cn("base", condition && "extra", className)` without pulling in clsx.
 */
export function cn(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(" ");
}
