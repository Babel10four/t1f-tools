import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** User-facing trees only — docs may mention these strings negatively. */
const SCAN_ROOTS = ["src/app", "src/components"] as const;

const FORBIDDEN = [
  "Loan Portal",
  "Loan Management",
  "Today page content coming soon",
  "Loans list coming soon",
  "Properties page coming soon",
] as const;

function collectFiles(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) collectFiles(p, out);
    else if (/\.(tsx|ts|jsx|js|css)$/.test(name)) out.push(p);
  }
  return out;
}

describe("legacy shell copy (RUNTIME-001)", () => {
  it("does not include forbidden loan-portal stub strings under app/components", () => {
    const root = process.cwd();
    const files = SCAN_ROOTS.flatMap((rel) => collectFiles(join(root, rel)));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const phrase of FORBIDDEN) {
        expect(text, `${file} must not contain "${phrase}"`).not.toContain(
          phrase,
        );
      }
    }
  });
});
