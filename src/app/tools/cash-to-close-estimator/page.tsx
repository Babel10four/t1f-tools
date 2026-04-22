import type { Metadata } from "next";
import { CashToCloseEstimatorClient } from "./cash-to-close-estimator-client";

export const metadata: Metadata = {
  title: "Cash to Close Calculator",
  description:
    "Cash-to-close-first UI for POST /api/deal/analyze (implementation per docs/specs/TICKET-005.md).",
};

/**
 * Cash to Close Calculator — rep-facing route (TICKET-005).
 * Internal JSON harness: /tools/deal-analyzer
 */
export default function CashToCloseEstimatorPage() {
  return <CashToCloseEstimatorClient />;
}
