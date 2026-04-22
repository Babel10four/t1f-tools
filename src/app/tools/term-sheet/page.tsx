import type { Metadata } from "next";
import { TermSheetGeneratorClient } from "./term-sheet-generator-client";

export const metadata: Metadata = {
  title: "Deal Sheet Builder",
  description:
    "Internal HTML term-sheet preview from POST /api/deal/analyze — docs/specs/TICKET-007.md",
};

/**
 * Deal Sheet Builder — route frozen at /tools/term-sheet (no /tools/term-sheet-generator).
 * @see docs/specs/TICKET-007.md
 */
export default function TermSheetPage() {
  return <TermSheetGeneratorClient />;
}
