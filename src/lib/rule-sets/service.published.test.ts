import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/db/client", () => ({
  getDb: vi.fn(),
}));

import { getDb } from "@/db/client";
import { getPublishedRuleSetByType } from "./service";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("getPublishedRuleSetByType", () => {
  it("returns the row from limit(1) chain", async () => {
    const published = {
      id: "p1",
      ruleType: "rates" as const,
      status: "published" as const,
    };
    const limit = vi.fn().mockResolvedValue([published]);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    vi.mocked(getDb).mockReturnValue({ select } as never);

    const row = await getPublishedRuleSetByType("rates");
    expect(row).toEqual(published);
    expect(limit).toHaveBeenCalledWith(1);
  });

  it("returns undefined when no published row", async () => {
    const limit = vi.fn().mockResolvedValue([]);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    vi.mocked(getDb).mockReturnValue({ select } as never);

    const row = await getPublishedRuleSetByType("calculator_assumptions");
    expect(row).toBeUndefined();
  });
});
