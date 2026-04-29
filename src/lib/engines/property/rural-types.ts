/**
 * TICKET-008 — POST /api/property/rural contracts (no deal engine).
 */

export type PropertyRuralRequestV1 = {
  addressLabel?: string;
  /** Full US mailing-style address for Census Geocoder enrichment (optional). */
  addressLine?: string;
  state?: string;
  county?: string;
  municipality?: string;
  population?: number;
  isInMsa?: boolean;
  userProvidedRuralIndicator?: boolean;
};

export type RuralCheckResult =
  | "likely_rural"
  | "likely_not_rural"
  | "insufficient_info"
  | "needs_review";

export type RuralCheckCertainty = "low" | "medium" | "high";

export type PropertyRuralRuleSetMeta = {
  id: string;
  versionLabel: string;
  ruleType: "rural_rules";
};

export type PropertyRuralPolicyMeta = {
  id: string;
  title: string;
  versionLabel: string;
};

/** Straight-line miles to nearest mapped OSM feature (not road-network distance). */
export type RuralOsmServiceDistancesV1 = {
  nearestPostOfficeStraightLineMiles: number | null;
  nearestHospitalOrUrgentStraightLineMiles: number | null;
  nearestSchoolStraightLineMiles: number | null;
  nearestGroceryOrMajorRetailStraightLineMiles: number | null;
  /** OSM completeness caveat */
  sourceNote: string;
};

export type RuralEvidenceCriterionStatus =
  | "meets_rural_signal"
  | "meets_not_rural_signal"
  | "inconclusive"
  | "public_data_unavailable";

/** Tier One–style criterion row for audit / UW (not a substitute for published `rural_rules`). */
export type RuralEvidenceCriterionV1 = {
  id: string;
  title: string;
  status: RuralEvidenceCriterionStatus;
  narrative: string;
  sources: string[];
  limitation?: string;
};

export type RuralEvidenceMitigantV1 = {
  label: string;
  detail: string;
};

/** Evidence matrix aligned with rural definition research — free public sources only. */
export type RuralEvidenceReportV1 = {
  schemaVersion: 1;
  /** Human-readable headline mapped from `result` + Tier One collateral framing */
  tierOneStyleDeterminationLabel: string;
  /** Count of automated “core” rural-lean signals we could evaluate from public data (max 5). */
  coreRuralIndicatorsPresent: number;
  coreRuralIndicatorsEvaluated: number;
  coreRuralIndicatorsSummary: string;
  criteria: RuralEvidenceCriterionV1[];
  mitigants: RuralEvidenceMitigantV1[];
  dataLimitations: string[];
  suggestedUwAction: string;
};

/** Census Geocoder + ACS + optional OSM — informational only */
export type RuralEnrichmentV1 = {
  attempted: boolean;
  matchedAddress: string | null;
  coordinates: { lat: number; lon: number } | null;
  censusTractGeoid: string | null;
  censusBlockGroupGeoid: string | null;
  countyName: string | null;
  stateAbbr: string | null;
  placeName: string | null;
  urbanAreaName: string | null;
  metropolitanAreaName: string | null;
  micropolitanAreaName: string | null;
  countyPopulationEstimate: number | null;
  /** County population ÷ county land area (ACS + geocoder) — coarse; see tract fields for Tier One density. */
  populationDensityPerSqMi: number | null;
  tractPopulationEstimate: number | null;
  tractLandSqMeters: number | null;
  tractPopulationDensityPerSqMi: number | null;
  blockGroupPopulationEstimate: number | null;
  blockGroupLandSqMeters: number | null;
  blockGroupPopulationDensityPerSqMi: number | null;
  geocoderTigerLineId: string | null;
  geocoderTigerLineSide: string | null;
  /** OSM amenity distances when coordinates available */
  osmServiceDistances: RuralOsmServiceDistancesV1 | null;
  nearestMajorHighwayStraightLineMiles: number | null;
  majorHighwayMitigationNote: string | null;
  distanceToPlaceCenterMiles: number | null;
  distanceToCbsaCenterMiles: number | null;
  nearestSubstationMiles: number | null;
  substationDataNote: string | null;
  comparableGeographyNote: string;
  warnings: string[];
};

export type PropertyRuralResponseV1 = {
  result: RuralCheckResult;
  certainty: RuralCheckCertainty;
  reasons: string[];
  warnings: string[];
  ruleSet: PropertyRuralRuleSetMeta | null;
  ruralPolicy: PropertyRuralPolicyMeta | null;
  disclaimer: string;
  /** Census/OSM context when `addressLine` was sent; null otherwise */
  enrichment: RuralEnrichmentV1 | null;
  /** Criterion-by-criterion public-data evidence (free sources); null when no screening ran */
  evidenceReport: RuralEvidenceReportV1 | null;
};
