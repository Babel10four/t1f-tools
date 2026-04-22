import { describe, expect, it } from "vitest";
import {
  getLegacyShellRedirects,
  LEGACY_SHELL_PATH_PREFIXES,
} from "./legacy-route-redirects";

describe("legacy-route-redirects (RUNTIME-001)", () => {
  it("emits exact + :path* redirect for each legacy prefix", () => {
    const r = getLegacyShellRedirects();
    expect(r.length).toBe(LEGACY_SHELL_PATH_PREFIXES.length * 2);
    for (const p of LEGACY_SHELL_PATH_PREFIXES) {
      expect(r.some((x) => x.source === p && x.destination === "/tools")).toBe(
        true,
      );
      expect(
        r.some((x) => x.source === `${p}/:path*` && x.destination === "/tools"),
      ).toBe(true);
    }
    expect(r.every((x) => x.permanent === false)).toBe(true);
  });
});
