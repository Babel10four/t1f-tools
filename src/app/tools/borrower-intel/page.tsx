import type { Metadata } from "next";
import { BorrowerIntelClient } from "./borrower-intel-client";

export const metadata: Metadata = {
  title: "Borrower Intel",
  description:
    "Generate a structured Borrower Snapshot from public web sources via Firecrawl + GPT (INTEL-001). Internal research only.",
};

export default function BorrowerIntelPage() {
  return <BorrowerIntelClient />;
}
