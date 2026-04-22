import type { NextConfig } from "next";
import { getLegacyShellRedirects } from "./src/lib/runtime/legacy-route-redirects";

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ["pdf-parse", "postgres", "drizzle-orm"],
  async redirects() {
    return getLegacyShellRedirects();
  },
};

export default nextConfig;
