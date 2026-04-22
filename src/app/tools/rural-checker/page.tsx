import type { Metadata } from "next";
import { RuralCheckerClient } from "./rural-checker-client";

export const metadata: Metadata = {
  title: "Rural Eligibility Checker",
  description:
    "Internal rural screening via POST /api/property/rural (docs/specs/TICKET-008.md).",
};

export default function RuralCheckerPage() {
  return <RuralCheckerClient />;
}
