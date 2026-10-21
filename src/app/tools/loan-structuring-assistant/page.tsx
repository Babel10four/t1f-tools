import type { Metadata } from "next";
import { connection } from "next/server";
import { resolveDealAnalyzePolicy } from "@/lib/engines/deal/policy/resolvePolicySnapshot";
import { LoanStructuringAssistantClient } from "./loan-structuring-assistant-client";

export const metadata: Metadata = {
  title: "Deal Structuring Copilot",
  description:
    "Guided bridge purchase and refinance inputs with full deal analysis — indicative and non-binding.",
};

/**
 * Deal Structuring Copilot (`/tools/loan-structuring-assistant`) — rep-facing route.
 * Frozen UI contract: docs/specs/TICKET-003.md
 */
export default async function LoanStructuringAssistantPage() {
  await connection();
  const policy = await resolveDealAnalyzePolicy();
  return <LoanStructuringAssistantClient calculator={{ purchaseTierRules: policy.calculator.purchaseTierRules }} />;
}
