import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/market/months-of-supply", () => {
  it("returns the current state-scoped snapshot", async () => {
    const response = await GET(
      new Request("http://localhost/api/market/months-of-supply?state=FL"),
    );
    const body = (await response.json()) as {
      snapshot: { lastUpdated: string; dataThrough: string };
      cities: Array<{ city: string; monthsOfSupply: number }>;
    };
    expect(response.status).toBe(200);
    expect(body.snapshot).toEqual({
      lastUpdated: "2026-09-03",
      dataThrough: "2026-08-31",
    });
    expect(body.cities.length).toBeGreaterThan(750);
    expect(body.cities).toContainEqual(
      expect.objectContaining({ city: "Tampa, FL", monthsOfSupply: 4.9 }),
    );
    expect(body.cities).toContainEqual(
      expect.objectContaining({ city: "Oak Hill, FL", monthsOfSupply: 0 }),
    );
  });

  it("rejects unsupported states", async () => {
    const response = await GET(
      new Request("http://localhost/api/market/months-of-supply?state=NY"),
    );
    expect(response.status).toBe(400);
  });
});
