import type { NextConfig } from "next";
import { getLegacyShellRedirects } from "./src/lib/runtime/legacy-route-redirects";

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ["pdf-parse", "postgres", "drizzle-orm"],
  /** Vercel serverless: include repo markdown + listing source for /docs routes. */
  outputFileTracingIncludes: {
    "/docs": ["./docs/TS Example/**/*"],
    "/docs/specs/user-term-sheet-calculator": [
      "./docs/specs/USER-TERM-SHEET-CALCULATOR-DESIGN.md",
    ],
    "/docs/specs/user-term-sheet-calculator/raw": [
      "./docs/specs/USER-TERM-SHEET-CALCULATOR-DESIGN.md",
    ],
  },
  async redirects() {
    return getLegacyShellRedirects();
  },
};

export default nextConfig;
