import type { Metadata } from "next";
import { connection } from "next/server";
import { resolveDealAnalyzePolicy } from "@/lib/engines/deal/policy/resolvePolicySnapshot";
import { TermSheetGeneratorClient } from "./term-sheet-generator-client";

export const metadata: Metadata = {
  title: "Deal Sheet Builder",
  description:
    "Build an indicative, non-binding term sheet from your deal inputs — aligned with published bridge policy.",
};

/**
 * Deal Sheet Builder — route frozen at /tools/term-sheet (no /tools/term-sheet-generator).
 * @see docs/specs/TICKET-007.md
 */
export default async function TermSheetPage() {
  await connection();
  const policy = await resolveDealAnalyzePolicy();
  return <TermSheetGeneratorClient calculator={{ purchaseTierRules: policy.calculator.purchaseTierRules }} />;
}
