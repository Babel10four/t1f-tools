import type { Metadata } from "next";
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
export default function TermSheetPage() {
  return <TermSheetGeneratorClient />;
}
