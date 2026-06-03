import type { Metadata } from "next";
import { PropertyIntelClient } from "./property-intel-client";

export const metadata: Metadata = {
  title: "Property Intel",
  description:
    "Assemble a Property Dossier from public listing and records sources via Firecrawl + GPT (INTEL-001). Internal research only.",
};

export default function PropertyIntelPage() {
  return <PropertyIntelClient />;
}
