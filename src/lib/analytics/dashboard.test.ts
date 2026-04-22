import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({
  getDb: vi.fn(() => {
    throw new Error("DATABASE_URL not set");
  }),
}));

import { getDashboardKpis } from "./dashboard";

describe("getDashboardKpis", () => {
  it("returns dbAvailable false when getDb throws", async () => {
    const kpis = await getDashboardKpis();
    expect(kpis.dbAvailable).toBe(false);
    expect(kpis.totals.dealAnalyzerRuns).toBe(0);
    expect(kpis.totals.loanStructuringAssistantRuns).toBe(0);
  });
});
