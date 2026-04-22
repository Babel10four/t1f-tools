import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("root route (TICKET-006)", () => {
  it("redirects to /tools", () => {
    const src = readFileSync(join(process.cwd(), "src/app/page.tsx"), "utf8");
    expect(src).toContain('redirect("/tools")');
  });
});

describe("next.config redirects (RUNTIME-001)", () => {
  it("wires legacy shell redirects from getLegacyShellRedirects", () => {
    const src = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
    expect(src).toContain("getLegacyShellRedirects");
    expect(src).toContain("async redirects()");
  });
});
