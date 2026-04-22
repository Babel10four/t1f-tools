import type { Metadata } from "next";
import { PricingCalculatorClient } from "./pricing-calculator-client";

export const metadata: Metadata = {
  title: "Loan Pricing Engine",
  description:
    "Pricing-first UI for POST /api/deal/analyze (docs/specs/TICKET-004.md).",
};

/** Rep-facing pricing-first route — TICKET-004. */
export default function PricingCalculatorPage() {
  return <PricingCalculatorClient />;
}
