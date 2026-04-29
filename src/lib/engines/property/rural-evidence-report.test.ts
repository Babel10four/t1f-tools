import { describe, expect, it } from "vitest";
import {
  attachRuralEvidenceToResponse,
  buildRuralEvidenceReport,
  ruralEvidenceConflictWarnings,
} from "./rural-evidence-report";
import type { PropertyRuralResponseV1, RuralEnrichmentV1 } from "./rural-types";

function baseEnrichment(over: Partial<RuralEnrichmentV1> = {}): RuralEnrichmentV1 {
  return {
    attempted: true,
    matchedAddress: "100 MAIN ST, X, VT, 05602",
    coordinates: { lat: 44.26, lon: -72.57 },
    censusTractGeoid: "50023954600",
    censusBlockGroupGeoid: "500239546002",
    countyName: "Washington County",
    stateAbbr: "VT",
    placeName: "Montpelier",
    urbanAreaName: null,
    metropolitanAreaName: null,
    micropolitanAreaName: null,
    countyPopulationEstimate: 50_000,
    populationDensityPerSqMi: 100,
    tractPopulationEstimate: 2089,
    tractLandSqMeters: 9_037_978,
    tractPopulationDensityPerSqMi: 598,
    blockGroupPopulationEstimate: 642,
    blockGroupLandSqMeters: 4_062_782,
    blockGroupPopulationDensityPerSqMi: 409,
    geocoderTigerLineId: "136690186",
    geocoderTigerLineSide: "L",
    osmServiceDistances: {
      nearestPostOfficeStraightLineMiles: 0.8,
      nearestHospitalOrUrgentStraightLineMiles: 1.2,
      nearestSchoolStraightLineMiles: 0.5,
      nearestGroceryOrMajorRetailStraightLineMiles: 1.0,
      sourceNote: "fixture",
    },
    nearestMajorHighwayStraightLineMiles: 2.5,
    majorHighwayMitigationNote: "fixture",
    distanceToPlaceCenterMiles: 1,
    distanceToCbsaCenterMiles: null,
    nearestSubstationMiles: 3,
    substationDataNote: null,
    comparableGeographyNote: "fixture comps note",
    warnings: [],
    ...over,
  };
}

describe("rural-evidence-report", () => {
  it("returns null when enrichment was not attempted", () => {
    const r = buildRuralEvidenceReport({
      result: "likely_not_rural",
      certainty: "high",
      enrichment: { ...baseEnrichment(), attempted: false },
    });
    expect(r).toBeNull();
  });

  it("labels Tier One outcomes from rule result", () => {
    const en = baseEnrichment();
    expect(
      buildRuralEvidenceReport({
        result: "likely_rural",
        certainty: "high",
        enrichment: en,
      })?.tierOneStyleDeterminationLabel,
    ).toBe("Likely Rural / Out of Policy");
    expect(
      buildRuralEvidenceReport({
        result: "likely_not_rural",
        certainty: "high",
        enrichment: en,
      })?.tierOneStyleDeterminationLabel,
    ).toBe("Likely Not Rural");
    expect(
      buildRuralEvidenceReport({
        result: "needs_review",
        certainty: "medium",
        enrichment: en,
      })?.tierOneStyleDeterminationLabel,
    ).toBe("Manual UW Review Required");
  });

  it("counts rural-lean density and non-rural-lean services when OSM shows close amenities", () => {
    const report = buildRuralEvidenceReport({
      result: "likely_rural",
      certainty: "medium",
      enrichment: baseEnrichment(),
    });
    expect(report).not.toBeNull();
    expect(report!.coreRuralIndicatorsEvaluated).toBe(5);
    expect(report!.coreRuralIndicatorsPresent).toBe(2);
    const density = report!.criteria.find((c) => c.id === "population_density");
    expect(density?.status).toBe("meets_rural_signal");
    const svc = report!.criteria.find((c) => c.id === "services_proximity");
    expect(svc?.status).toBe("meets_not_rural_signal");
  });

  it("adds conflict warnings when likely_rural conflicts with tract density", () => {
    const en = baseEnrichment({
      tractPopulationDensityPerSqMi: 1200,
      blockGroupPopulationDensityPerSqMi: 1100,
    });
    const res: PropertyRuralResponseV1 = {
      result: "likely_rural",
      certainty: "high",
      reasons: [],
      warnings: [],
      ruleSet: null,
      ruralPolicy: null,
      disclaimer: "",
      enrichment: en,
      evidenceReport: null,
    };
    const w = ruralEvidenceConflictWarnings(res);
    expect(w.some((x) => x.includes("1,000"))).toBe(true);
    const attached = attachRuralEvidenceToResponse(res);
    expect(attached.warnings.length).toBeGreaterThan(0);
    expect(attached.evidenceReport?.schemaVersion).toBe(1);
  });
});
