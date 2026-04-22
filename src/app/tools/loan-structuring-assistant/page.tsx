import type { Metadata } from "next";
import { LoanStructuringAssistantClient } from "./loan-structuring-assistant-client";

export const metadata: Metadata = {
  title: "Deal Structuring Copilot",
  description:
    "Rep-facing deal structuring UI for POST /api/deal/analyze (implementation per docs/specs/TICKET-003.md).",
};

/**
 * Deal Structuring Copilot (`/tools/loan-structuring-assistant`) — rep-facing route.
 * Frozen UI contract: docs/specs/TICKET-003.md
 * Internal JSON harness: /tools/deal-analyzer
 */
export default function LoanStructuringAssistantPage() {
  return <LoanStructuringAssistantClient />;
}
