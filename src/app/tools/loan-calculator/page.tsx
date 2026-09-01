import type { Metadata } from "next";
import { LoanCalculatorClient } from "./loan-calculator-client";

export const metadata: Metadata = {
  title: "Loan Calculator",
  description:
    "T1F loan sizing, pricing, construction advance, and virtual-inspection eligibility.",
};

export default function LoanCalculatorPage() {
  return <LoanCalculatorClient />;
}
