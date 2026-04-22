/**
 * Copies public reference assets into `public/docs/` so Vercel serves them
 * from the same origin as t1f.tools (no serverless FS reads for binaries).
 * Run via `prebuild` and at the start of `dev`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const tsExampleSrc = path.join(root, "docs", "TS Example");
const tsExampleDest = path.join(root, "public", "docs", "ts-example");

function copyDirFiles(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`[sync-public-docs] skip missing: ${src}`);
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const from = path.join(src, name);
    if (fs.statSync(from).isDirectory()) continue;
    fs.copyFileSync(from, path.join(dest, name));
  }
  console.log(`[sync-public-docs] synced → ${path.relative(root, dest)}`);
}

copyDirFiles(tsExampleSrc, tsExampleDest);
