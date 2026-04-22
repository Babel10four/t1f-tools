import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const SPEC_REL = path.join("docs", "specs", "USER-TERM-SHEET-CALCULATOR-DESIGN.md");

export async function GET() {
  const fullPath = path.join(process.cwd(), SPEC_REL);
  const body = await fs.readFile(fullPath, "utf8");
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=3600",
    },
  });
}
