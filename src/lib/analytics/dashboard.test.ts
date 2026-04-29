import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({
  getDb: vi.fn(() => {
    throw new Error("DATABASE_URL not set");
  }),
}));

import { getDashboardKpis, parseDashboardWindowDays } from "./dashboard";

describe("getDashboardKpis", () => {
  it("returns dbAvailable false when getDb throws", async () => {
    const kpis = await getDashboardKpis();
    expect(kpis.dbAvailable).toBe(false);
    expect(kpis.totals.dealAnalyzerRuns).toBe(0);
    expect(kpis.totals.loanStructuringAssistantRuns).toBe(0);
    expect(kpis.termSheetCollateralAddresses).toEqual([]);
    expect(kpis.cashToCloseCollateralAddresses).toEqual([]);
    expect(kpis.ruralCheckAddresses).toEqual([]);
  });
});

describe("parseDashboardWindowDays", () => {
  it("defaults and accepts presets", () => {
    expect(parseDashboardWindowDays(undefined)).toBe(7);
    expect(parseDashboardWindowDays("30")).toBe(30);
    expect(parseDashboardWindowDays("90")).toBe(90);
    expect(parseDashboardWindowDays("180")).toBe(180);
  });

  it("accepts arbitrary days within bounds", () => {
    expect(parseDashboardWindowDays("14")).toBe(14);
    expect(parseDashboardWindowDays("366")).toBe(366);
  });

  it("clamps oversized values", () => {
    expect(parseDashboardWindowDays("5000")).toBe(366);
  });
});
