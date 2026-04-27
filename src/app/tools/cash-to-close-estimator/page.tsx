import type { Metadata } from "next";
import { CashToCloseEstimatorClient } from "./cash-to-close-estimator-client";

export const metadata: Metadata = {
  title: "Cash to Close Calculator",
  description:
    "Estimate cash to close from purchase or refinance inputs — directional, non-binding.",
};

/**
 * Cash to Close Calculator — rep-facing route (TICKET-005).
 */
export default function CashToCloseEstimatorPage() {
  return <CashToCloseEstimatorClient />;
}
