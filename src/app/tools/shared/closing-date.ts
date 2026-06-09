/**
 * Shared helpers for the user-selectable closing date that drives cash-to-close /
 * term-sheet per-diem interest. Dates are stored as `YYYY-MM-DD` strings (matching native
 * `<input type="date">`) and parsed as *local* dates so the day-of-month math is not shifted by
 * the user's timezone.
 */

/** Today as a local `YYYY-MM-DD` string. */
export function todayLocalYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Parse a `YYYY-MM-DD` string into a local `Date` (midnight local). Returns `undefined` for
 * blank or malformed input, so callers fall back to "today" for the interest assumption.
 */
export function parseLocalYmd(ymd: string | null | undefined): Date | undefined {
  if (typeof ymd !== "string") {
    return undefined;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) {
    return undefined;
  }
  const year = Number(m[1]);
  const monthIndex = Number(m[2]) - 1;
  const day = Number(m[3]);
  const d = new Date(year, monthIndex, day);
  // Guard against rollovers like 2026-02-31 → Mar 3.
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== monthIndex ||
    d.getDate() !== day
  ) {
    return undefined;
  }
  return d;
}

/** Format a `Date` as a short local date (e.g. "Jun 8, 2026"). */
export function formatDateLong(d: Date): string {
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Format a `YYYY-MM-DD` string as a short local date (e.g. "Jun 8, 2026"); "—" when blank/invalid. */
export function formatLocalYmdLong(ymd: string | null | undefined): string {
  const d = parseLocalYmd(ymd);
  if (!d) {
    return "—";
  }
  return formatDateLong(d);
}
