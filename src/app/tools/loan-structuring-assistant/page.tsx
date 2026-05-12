import type { Metadata } from "next";
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
export default function LoanStructuringAssistantPage() {
  return <LoanStructuringAssistantClient />;
}
