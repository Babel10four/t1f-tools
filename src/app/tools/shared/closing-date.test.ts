import { describe, expect, it } from "vitest";
import { formatDateLong, parseLocalYmd, todayLocalYmd } from "./closing-date";

describe("parseLocalYmd", () => {
  it("parses a valid YYYY-MM-DD into a local date", () => {
    const d = parseLocalYmd("2026-06-15");
    expect(d).toBeInstanceOf(Date);
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(5); // June (zero-indexed)
    expect(d?.getDate()).toBe(15);
  });

  it("returns undefined for blank, malformed, or rolled-over dates", () => {
    expect(parseLocalYmd("")).toBeUndefined();
    expect(parseLocalYmd("   ")).toBeUndefined();
    expect(parseLocalYmd("2026/06/15")).toBeUndefined();
    expect(parseLocalYmd("not-a-date")).toBeUndefined();
    expect(parseLocalYmd(undefined)).toBeUndefined();
    expect(parseLocalYmd(null)).toBeUndefined();
    expect(parseLocalYmd("2026-02-31")).toBeUndefined();
  });
});

describe("formatDateLong", () => {
  it("formats a date as a short month/day/year string", () => {
    expect(formatDateLong(new Date(2026, 5, 15))).toBe("Jun 15, 2026");
  });
});

describe("todayLocalYmd", () => {
  it("produces a YYYY-MM-DD string that round-trips through parseLocalYmd", () => {
    const ymd = todayLocalYmd();
    expect(ymd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(parseLocalYmd(ymd)).toBeInstanceOf(Date);
  });
});
