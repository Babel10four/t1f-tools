import { describe, expect, it } from "vitest";
import { haversineMiles } from "./rural-enrichment";

describe("haversineMiles", () => {
  it("returns ~0 for identical points", () => {
    expect(haversineMiles(40.7, -74, 40.7, -74)).toBeLessThan(0.001);
  });

  it("returns plausible distance for NYC to DC", () => {
    const d = haversineMiles(40.7128, -74.006, 38.9072, -77.0369);
    expect(d).toBeGreaterThan(180);
    expect(d).toBeLessThan(240);
  });
});
