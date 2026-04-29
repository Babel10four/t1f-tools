/**
 * Tier One–style rural evidence matrix from public data + published rule outcome.
 * Does not replace `rural_rules` scoring; documents sources and limitations.
 */
import type {
  PropertyRuralResponseV1,
  RuralCheckResult,
  RuralEvidenceCriterionStatus,
  RuralEvidenceCriterionV1,
  RuralEvidenceMitigantV1,
  RuralEvidenceReportV1,
  RuralEnrichmentV1,
} from "./rural-types";

function tierOneDeterminationLabel(result: RuralCheckResult): string {
  switch (result) {
    case "likely_rural":
      return "Likely Rural / Out of Policy";
    case "likely_not_rural":
      return "Likely Not Rural";
    case "needs_review":
    case "insufficient_info":
      return "Manual UW Review Required";
    default: {
      const _x: never = result;
      return _x;
    }
  }
}

function uwActionSuggestion(result: RuralCheckResult): string {
  switch (result) {
    case "likely_rural":
      return "Treat as rural / out-of-policy collateral under Tier One credit policy unless a documented exception applies; consider UW manager review when public signals conflict.";
    case "likely_not_rural":
      return "Screening leans non-rural on published rules + public context; still confirm parcel boundaries, site acreage, MLS comps, and any program-specific rural maps before collateral approval.";
    case "needs_review":
      return "Escalate for manual underwriting review; obtain MLS or licensed valuation support for comparable sales and DOM before treating market liquidity as proven.";
    case "insufficient_info":
      return "Collect a geocodable U.S. address or explicit manual rural signals (population, MSA, user indicator) before relying on this screen for credit decisions.";
    default: {
      const _x: never = result;
      return _x;
    }
  }
}

function formatMi(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) {
    return "unknown";
  }
  return `${n.toFixed(1)} mi (straight-line)`;
}

function formatDensity(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) {
    return "unknown";
  }
  return `${Math.round(n).toLocaleString()} persons/sq. mi.`;
}

function densityRuralLean(en: RuralEnrichmentV1): boolean | null {
  const t = en.tractPopulationDensityPerSqMi;
  if (t !== null && Number.isFinite(t)) {
    return t < 1000;
  }
  const bg = en.blockGroupPopulationDensityPerSqMi;
  if (bg !== null && Number.isFinite(bg)) {
    return bg < 1000;
  }
  return null;
}

function servicesRuralLean(en: RuralEnrichmentV1): boolean | null {
  const s = en.osmServiceDistances;
  if (!s) {
    return null;
  }
  const vals = [
    s.nearestPostOfficeStraightLineMiles,
    s.nearestHospitalOrUrgentStraightLineMiles,
    s.nearestSchoolStraightLineMiles,
    s.nearestGroceryOrMajorRetailStraightLineMiles,
  ];
  if (vals.some((v) => v === null || v === undefined || !Number.isFinite(v))) {
    return null;
  }
  return vals.every((v) => (v as number) > 5);
}

/** True = no named Census Urban Area returned (weak rural-context signal only). */
function outsideNamedUrbanArea(en: RuralEnrichmentV1): boolean | null {
  if (!en.coordinates) {
    return null;
  }
  if (en.urbanAreaName && en.urbanAreaName.trim() !== "") {
    return false;
  }
  return true;
}

export function buildRuralEvidenceReport(
  res: Pick<PropertyRuralResponseV1, "result" | "certainty" | "enrichment">,
): RuralEvidenceReportV1 | null {
  const { result, certainty, enrichment: en } = res;
  if (!en?.attempted) {
    return null;
  }

  const dr = densityRuralLean(en);
  const sr = servicesRuralLean(en);
  const oua = outsideNamedUrbanArea(en);

  const autoSlotsMeasured =
    (dr !== null ? 1 : 0) + (sr !== null ? 1 : 0) + (oua !== null ? 1 : 0);
  const present =
    (dr === true ? 1 : 0) + (sr === true ? 1 : 0) + (oua === true ? 1 : 0);
  const evaluated = 5;
  const coreRuralIndicatorsSummary = `Tier One rural guideline references five core themes (density, services, site, land use, comps). This public build fully automates up to three geography-based checks; ${present} show rural-lean signals here, with ${autoSlotsMeasured}/3 of those checks having complete public inputs. Parcel acreage and MLS-grade comps/DOM still require manual or licensed data — treat those slots as Manual UW Review by default.`;

  const criteria: RuralEvidenceCriterionV1[] = [];

  criteria.push({
    id: "geocode",
    title: "Base address & Census geography",
    status: "inconclusive",
    narrative:
      en.coordinates && en.matchedAddress
        ? `Matched to “${en.matchedAddress}” with coordinates ${en.coordinates.lat.toFixed(5)}, ${en.coordinates.lon.toFixed(5)}. Census tract ${en.censusTractGeoid ?? "—"}, block group ${en.censusBlockGroupGeoid ?? "—"}.${en.geocoderTigerLineId ? ` MAF/TIGER line id ${en.geocoderTigerLineId} (${en.geocoderTigerLineSide ?? "?"} side).` : ""}`
        : "Geocoder did not return coordinates — downstream density and distance checks are weakened.",
    sources: ["U.S. Census Geocoder (locations + geographies)"],
    limitation:
      "Bad geocodes invalidate downstream tests; confirm match quality on the ground or with county GIS.",
  });

  let densityStatus: RuralEvidenceCriterionStatus = "inconclusive";
  let densityNarrative =
    "Tract and block-group population density were not both derivable from ACS + geocoder land area.";
  if (en.tractPopulationDensityPerSqMi !== null) {
    densityNarrative = `Primary (tract) density ${formatDensity(en.tractPopulationDensityPerSqMi)} (ACS 2022 5-year population ÷ Census tract land area).`;
    if (en.blockGroupPopulationDensityPerSqMi !== null) {
      densityNarrative += ` Block group density ${formatDensity(en.blockGroupPopulationDensityPerSqMi)} (finer geography; still not parcel-level).`;
    }
    densityNarrative += ` Tier One guideline reference: rural-lean below 1,000 persons/sq. mi. at census geography.`;
    if (en.tractPopulationDensityPerSqMi < 1000) {
      densityStatus = "meets_rural_signal";
    } else {
      densityStatus = "meets_not_rural_signal";
    }
  } else if (en.blockGroupPopulationDensityPerSqMi !== null) {
    densityNarrative = `Block group density ${formatDensity(en.blockGroupPopulationDensityPerSqMi)} (tract-level ACS land split unavailable).`;
    densityStatus =
      en.blockGroupPopulationDensityPerSqMi < 1000
        ? "meets_rural_signal"
        : "meets_not_rural_signal";
  }
  criteria.push({
    id: "population_density",
    title: "Population density (< 1,000 / sq. mi. guideline)",
    status: densityStatus,
    narrative: densityNarrative,
    sources: [
      "Census ACS 2022 5-year (B01003)",
      "Census MAF/TIGER tract / block group land area (geocoder)",
    ],
    limitation:
      "Tract-level density can mask suburban pockets; block group refines but is still not parcel-level. USDA RUCA / Urban Area polygons are not yet wired as an automatic pass/fail.",
  });

  if (en.urbanAreaName) {
    criteria.push({
      id: "census_urban_area",
      title: "Census Urban Area association",
      status: "meets_not_rural_signal",
      narrative: `Address falls in named Census Urban Area: ${en.urbanAreaName}. This is typically a non-rural mitigant in public screening (not an MLS “urban” label).`,
      sources: ["Census Geocoder Urban Areas layer"],
    });
  } else if (en.coordinates) {
    criteria.push({
      id: "census_urban_area",
      title: "Census Urban Area association",
      status: "meets_rural_signal",
      narrative:
        "No Census Urban Area polygon was returned for this match — weak rural-context signal only.",
      sources: ["Census Geocoder Urban Areas layer"],
      limitation: "Absence of an Urban Area label does not prove remoteness.",
    });
  }

  const s = en.osmServiceDistances;
  let svcStatus: RuralEvidenceCriterionStatus = "inconclusive";
  let svcNarrative = "Service distances were not retrieved.";
  if (s) {
    svcNarrative = `Nearest mapped features (straight-line, OSM): post office ${formatMi(s.nearestPostOfficeStraightLineMiles)}; hospital / clinic / doctors ${formatMi(s.nearestHospitalOrUrgentStraightLineMiles)}; school ${formatMi(s.nearestSchoolStraightLineMiles)}; major retail (supermarket / department / mall) ${formatMi(s.nearestGroceryOrMajorRetailStraightLineMiles)}. Guideline reference: services commonly described as > 5 road miles away in rural definitions — here we only have geodesic distance. ${s.sourceNote}`;
    if (sr === true) {
      svcStatus = "meets_rural_signal";
    } else if (sr === false) {
      svcStatus = "meets_not_rural_signal";
    } else {
      svcStatus = "inconclusive";
    }
  }
  criteria.push({
    id: "services_proximity",
    title: "Proximity to services (post office, care, school, retail hub)",
    status: svcStatus,
    narrative: svcNarrative,
    sources: ["OpenStreetMap / Overpass API"],
    limitation:
      "OSM is incomplete; HIFLD hospitals and NCES school locations are not merged in this Tier One public stack yet. No substitute for road-network routing.",
  });

  criteria.push({
    id: "employment_centers",
    title: "Proximity to employment centers / job density",
    status: "public_data_unavailable",
    narrative:
      "Not computed in this build. Census LEHD LODES / OnTheMap / CBP could support “nearby jobs within 5–10 miles” style metrics with an explicit internal threshold disclosed to underwriters.",
    sources: ["— (planned: Census LEHD/LODES, County Business Patterns)"],
    limitation:
      "Guidelines rarely define “primary employment center” numerically — this remains an underwriter judgment field.",
  });

  criteria.push({
    id: "highway_access",
    title: "Major transportation route (mitigant only)",
    status: "inconclusive",
    narrative:
      en.nearestMajorHighwayStraightLineMiles !== null &&
      Number.isFinite(en.nearestMajorHighwayStraightLineMiles)
        ? `Nearest mapped motorway/trunk centerline ≈ ${formatMi(en.nearestMajorHighwayStraightLineMiles)}. ${en.majorHighwayMitigationNote ?? ""}`
        : en.majorHighwayMitigationNote ??
          "Motorway/trunk proximity not determined from OSM in this pass.",
    sources: ["OpenStreetMap (highway=motorway|trunk)", "NHPN not wired"],
    limitation:
      "A property can still be rural near a highway; this is access context, not a pass/fail override.",
  });

  criteria.push({
    id: "parcel_site_size",
    title: "Site size ≥ 0.50 acres",
    status: "inconclusive",
    narrative:
      "Parcel acreage is not pulled from county assessor / national parcel APIs in this free-data build. Provide acreage manually in underwriting or integrate licensed parcel data.",
    sources: ["— (planned: county assessor / GIS)"],
    limitation:
      "If acreage is missing or conflicting across sources, policy calls for Manual UW Review.",
  });

  criteria.push({
    id: "surrounding_land_use",
    title: "Surrounding land use (ag / vacant vs. developed)",
    status: "public_data_unavailable",
    narrative:
      "NLCD / county zoning buffers are not computed server-side here. Manual GIS or appraiser land-use narrative is still required for a defensible land-use test.",
    sources: ["— (planned: NLCD, county land-use GIS)"],
    limitation: "NLCD is land cover, not legal zoning.",
  });

  criteria.push({
    id: "water_sewer",
    title: "Public water / sewer service areas (supporting)",
    status: "public_data_unavailable",
    narrative:
      "EPA / local utility service polygons are not queried in this build. Well/septic clues from OSM are not used as automatic rural proof.",
    sources: ["— (planned: EPA PWS service areas, local GIS)"],
  });

  criteria.push({
    id: "comps_liquidity",
    title: "Comparable sales & DOM (≥10 comps / 2 mi; DOM 30–90 guideline)",
    status: "public_data_unavailable",
    narrative:
      "Market liquidity is not publicly verifiable to MLS standards in this tool. County recorder counts lack DOM, listing status, and concessions. Label findings as public-record–supported only.",
    sources: ["— (MLS RESO / valuation vendor not connected)"],
    limitation: en.comparableGeographyNote,
  });

  const mitigants: RuralEvidenceMitigantV1[] = [];
  if (
    en.nearestMajorHighwayStraightLineMiles !== null &&
    en.nearestMajorHighwayStraightLineMiles <= 3
  ) {
    mitigants.push({
      label: "Highway / major route access",
      detail: `Nearest mapped motorway/trunk ≈ ${en.nearestMajorHighwayStraightLineMiles.toFixed(1)} mi straight-line — consider improved market access vs. pure remoteness.`,
    });
  }
  if (en.metropolitanAreaName) {
    mitigants.push({
      label: "Metropolitan CBSA context",
      detail: `Census metropolitan CBSA: ${en.metropolitanAreaName} — typically weighs against a “remote rural services” story even if local OSM amenities are sparse.`,
    });
  }
  if (en.micropolitanAreaName && !en.metropolitanAreaName) {
    mitigants.push({
      label: "Micropolitan CBSA context",
      detail: `Census micropolitan area: ${en.micropolitanAreaName} — review policy on whether this mitigates rural treatment.`,
    });
  }

  const dataLimitations: string[] = [
    "USDA Rural Development eligibility maps are not used as the Tier One rural determination (program-specific; see USDA disclaimers).",
    "FFIEC Geocoder secondary match is not run in this build.",
    "Employment clusters (LODES), NLCD buffers, EPA water/sewer, HIFLD/NCES facility precision, and MLS DOM are not fully implemented on the free public path.",
  ];
  if (certainty === "low" || certainty === "medium") {
    dataLimitations.push(
      `Screening certainty is ${certainty} — treat published rule output and public evidence as provisional.`,
    );
  }

  return {
    schemaVersion: 1,
    tierOneStyleDeterminationLabel: tierOneDeterminationLabel(result),
    coreRuralIndicatorsPresent: present,
    coreRuralIndicatorsEvaluated: evaluated,
    coreRuralIndicatorsSummary,
    criteria,
    mitigants,
    dataLimitations,
    suggestedUwAction: uwActionSuggestion(result),
  };
}

export function ruralEvidenceConflictWarnings(
  res: PropertyRuralResponseV1,
): string[] {
  const w: string[] = [];
  const en = res.enrichment;
  if (!en?.attempted || !en.coordinates) {
    return w;
  }
  const td = en.tractPopulationDensityPerSqMi;
  if (res.result === "likely_rural") {
    if (td !== null && td >= 1000) {
      w.push(
        `Public tract density (${Math.round(td).toLocaleString()} /sq. mi.) is at or above the 1,000/sq. mi. rural guideline reference — conflicts with “likely rural” rule output; Manual UW Review Required on substance.`,
      );
    }
    if (en.urbanAreaName) {
      w.push(
        "Address is inside a named Census Urban Area while the rule engine returned likely rural — reconcile with policy before relying on the automated score alone.",
      );
    }
  }
  if (res.result === "likely_not_rural") {
    if (
      td !== null &&
      td < 600 &&
      !en.urbanAreaName &&
      !en.metropolitanAreaName
    ) {
      w.push(
        "Tract density is materially low and no metropolitan CBSA or Census Urban Area was returned — public context may still look rural; confirm comps, parcel size, and land use before treating as clearly non-rural.",
      );
    }
  }
  return w;
}

export function attachRuralEvidenceToResponse(
  res: PropertyRuralResponseV1,
): PropertyRuralResponseV1 {
  const conflicts = ruralEvidenceConflictWarnings(res);
  const evidenceReport = buildRuralEvidenceReport(res);
  return {
    ...res,
    warnings: conflicts.length ? [...res.warnings, ...conflicts] : res.warnings,
    evidenceReport,
  };
}

/** UI headline — Tier One wording when an evidence report exists, else derive from `result`. */
export function ruralScreeningHeading(res: PropertyRuralResponseV1): string {
  return (
    res.evidenceReport?.tierOneStyleDeterminationLabel ??
    tierOneDeterminationLabel(res.result)
  );
}
