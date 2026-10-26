import type { DealAnalyzeRequestV1 } from "@/lib/engines/deal/schemas/canonical-request";

/** Label the explicit input basis, not an underwriting approval or inferred seasoning. */
export function termSheetScenarioBasis(request: DealAnalyzeRequestV1 | undefined): string | undefined {
  if (
    request?.deal.purpose !== "refinance" ||
    request.programContext?.scenario !== "refinance_seasoned"
  ) {
    return undefined;
  }
  return "Seasoned refinance with rehab (Tier 0/1): 70% ARV total-loan cap including rehab holdback. More than 180 days of seasoning confirmed in inputs; subject to underwriting verification.";
}
