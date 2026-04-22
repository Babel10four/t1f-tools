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

/** Census Geocoder + ACS + optional OSM — informational only */
export type RuralEnrichmentV1 = {
  attempted: boolean;
  matchedAddress: string | null;
  coordinates: { lat: number; lon: number } | null;
  censusTractGeoid: string | null;
  countyName: string | null;
  stateAbbr: string | null;
  placeName: string | null;
  urbanAreaName: string | null;
  metropolitanAreaName: string | null;
  micropolitanAreaName: string | null;
  countyPopulationEstimate: number | null;
  populationDensityPerSqMi: number | null;
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
};
