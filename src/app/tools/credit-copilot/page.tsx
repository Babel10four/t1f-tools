import type { Metadata } from "next";
import { CreditCopilotClient } from "./credit-copilot-client";

export const metadata: Metadata = {
  title: "Credit Copilot",
  description:
    "Internal credit policy Q&A via POST /api/credit-copilot/ask (docs/specs/TICKET-009.md).",
};

export default function CreditCopilotPage() {
  return <CreditCopilotClient />;
}
