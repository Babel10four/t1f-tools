/**
 * Optional address enrichment for Rural Checker — Census Geocoder + ACS + OSM (TICKET-008 extension).
 * Not a legal determination; external data may be incomplete or stale.
 */
import type {
  PropertyRuralRequestV1,
  RuralEnrichmentV1,
  RuralOsmServiceDistancesV1,
} from "./rural-types";

const CENSUS_LOCATIONS =
  "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";
const CENSUS_GEOGRAPHIES =
  "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress";
const ACS5_BASE = "https://api.census.gov/data/2022/acs/acs5";
const OVERPASS = "https://overpass-api.de/api/interpreter";
const USER_AGENT =
  "T1F.tools/rural-checker (internal; +https://github.com/)";

const GEO_LAYERS = [
  "Metropolitan Statistical Areas",
  "Micropolitan Statistical Areas",
  "Urban Areas",
  "Incorporated Places",
  "Counties",
  "Census Tracts",
  "Census Block Groups",
  "States",
].join(",");

const SQ_METERS_PER_SQ_MI = 2_589_988.110336;

function parseCoord(s: string | undefined): number | null {
  if (!s || typeof s !== "string") {
    return null;
  }
  const n = Number.parseFloat(s.replace(/^\+/, ""));
  return Number.isFinite(n) ? n : null;
}

export function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 3958.7613; // Earth radius in miles (WGS84 mean)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function fetchJson(
  url: string,
  init?: RequestInit,
): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
      ...init?.headers,
    },
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json() as Promise<unknown>;
}

function firstGeo(
  geographies: Record<string, unknown[]>,
  key: string,
): Record<string, string> | null {
  const arr = geographies[key];
  if (!Array.isArray(arr) || arr.length === 0) {
    return null;
  }
  const row = arr[0];
  if (!row || typeof row !== "object") {
    return null;
  }
  return row as Record<string, string>;
}

function parseTractGeoidForAcs(
  geoid11: string,
): { state: string; county: string; tract: string } | null {
  if (!/^\d{11}$/.test(geoid11)) {
    return null;
  }
  return {
    state: geoid11.slice(0, 2),
    county: geoid11.slice(2, 5),
    tract: geoid11.slice(5),
  };
}

/** 12-digit block group GEOID → ACS `for=block group:` path segments */
function parseBlockGroupGeoidForAcs(
  geoid12: string,
): { state: string; county: string; tract: string; blockGroup: string } | null {
  if (!/^\d{12}$/.test(geoid12)) {
    return null;
  }
  const bgRaw = geoid12.slice(11);
  const blockGroup = /^0+$/.test(bgRaw) ? "0" : bgRaw.replace(/^0+/, "") || "0";
  return {
    state: geoid12.slice(0, 2),
    county: geoid12.slice(2, 5),
    tract: geoid12.slice(5, 11),
    blockGroup,
  };
}

async function acsPopulationCell(
  url: string,
): Promise<number | null> {
  try {
    const acs = (await fetchJson(url)) as unknown[];
    const row = Array.isArray(acs) && acs.length >= 2 ? acs[1] : null;
    const popStr = Array.isArray(row) ? row[0] : null;
    const pop = typeof popStr === "string" ? Number.parseInt(popStr, 10) : NaN;
    return Number.isFinite(pop) ? pop : null;
  } catch {
    return null;
  }
}

function densityPerSqMi(pop: number, landSqM: number): number | null {
  if (!Number.isFinite(pop) || !Number.isFinite(landSqM) || landSqM <= 0) {
    return null;
  }
  const sqMi = landSqM / SQ_METERS_PER_SQ_MI;
  return pop / sqMi;
}

type OsmEl = {
  type?: string;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

function minDistMiles(
  lat: number,
  lon: number,
  elements: OsmEl[],
  accept: (tags: Record<string, string>) => boolean,
): number | null {
  let best: number | null = null;
  for (const el of elements) {
    let plat: number | undefined;
    let plon: number | undefined;
    if (typeof el.lat === "number" && typeof el.lon === "number") {
      plat = el.lat;
      plon = el.lon;
    } else if (
      el.center &&
      typeof el.center.lat === "number" &&
      typeof el.center.lon === "number"
    ) {
      plat = el.center.lat;
      plon = el.center.lon;
    }
    if (plat === undefined || plon === undefined) {
      continue;
    }
    const tags = el.tags ?? {};
    if (!accept(tags)) {
      continue;
    }
    const d = haversineMiles(lat, lon, plat, plon);
    if (best === null || d < best) {
      best = d;
    }
  }
  return best;
}

async function fetchOsmServiceDistances(
  lat: number,
  lon: number,
): Promise<RuralOsmServiceDistancesV1> {
  const q = `[out:json][timeout:20];
(
  node["amenity"="post_office"](around:90000,${lat},${lon});
  node["amenity"="hospital"](around:90000,${lat},${lon});
  node["amenity"="clinic"](around:90000,${lat},${lon});
  node["amenity"="doctors"](around:90000,${lat},${lon});
  node["healthcare"="hospital"](around:90000,${lat},${lon});
  node["amenity"="school"](around:90000,${lat},${lon});
  node["shop"~"supermarket|department_store|mall"](around:90000,${lat},${lon});
);
out body 50;`;

  const overRes = await fetch(OVERPASS, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: `data=${encodeURIComponent(q)}`,
    signal: AbortSignal.timeout(22_000),
  });
  if (!overRes.ok) {
    return {
      nearestPostOfficeStraightLineMiles: null,
      nearestHospitalOrUrgentStraightLineMiles: null,
      nearestSchoolStraightLineMiles: null,
      nearestGroceryOrMajorRetailStraightLineMiles: null,
      sourceNote:
        "OpenStreetMap Overpass request failed — service distances unavailable.",
    };
  }
  const overJson = (await overRes.json()) as { elements?: OsmEl[] };
  const els = overJson.elements ?? [];

  const post = minDistMiles(lat, lon, els, (t) => t.amenity === "post_office");
  const hosp = minDistMiles(
    lat,
    lon,
    els,
    (t) =>
      t.amenity === "hospital" ||
      t.healthcare === "hospital" ||
      t.amenity === "clinic" ||
      t.amenity === "doctors",
  );
  const school = minDistMiles(lat, lon, els, (t) => t.amenity === "school");
  const retail = minDistMiles(lat, lon, els, (t) => {
    const s = t.shop ?? "";
    return (
      s === "supermarket" || s === "department_store" || s === "mall"
    );
  });

  return {
    nearestPostOfficeStraightLineMiles: post,
    nearestHospitalOrUrgentStraightLineMiles: hosp,
    nearestSchoolStraightLineMiles: school,
    nearestGroceryOrMajorRetailStraightLineMiles: retail,
    sourceNote:
      "Straight-line miles to nearest mapped OpenStreetMap features (not driving distance). OSM coverage varies by market; hospitals may be incomplete vs. licensed facility lists.",
  };
}

async function fetchNearestMajorHighwayMiles(
  lat: number,
  lon: number,
): Promise<{ miles: number | null; note: string | null }> {
  const q = `[out:json][timeout:18];
(
  way["highway"="motorway"](around:45000,${lat},${lon});
  way["highway"="trunk"](around:45000,${lat},${lon});
);
out center 20;`;

  try {
    const overRes = await fetch(OVERPASS, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": USER_AGENT,
      },
      body: `data=${encodeURIComponent(q)}`,
      signal: AbortSignal.timeout(20_000),
    });
    if (!overRes.ok) {
      return { miles: null, note: "Highway proximity lookup failed (HTTP)." };
    }
    const overJson = (await overRes.json()) as { elements?: OsmEl[] };
    const els = overJson.elements ?? [];
    const miles = minDistMiles(lat, lon, els, () => true);
    return {
      miles,
      note:
        miles !== null
          ? "Nearest mapped motorway/trunk centerline (OSM). Shown as a potential access mitigant only — not a ‘not rural’ override."
          : "No motorway/trunk mapped within ~28 mi search radius (OSM may be incomplete).",
    };
  } catch {
    return { miles: null, note: "Highway proximity lookup timed out or failed." };
  }
}

function emptyEnrichmentBase(): RuralEnrichmentV1 {
  return {
    attempted: true,
    matchedAddress: null,
    coordinates: null,
    censusTractGeoid: null,
    censusBlockGroupGeoid: null,
    countyName: null,
    stateAbbr: null,
    placeName: null,
    urbanAreaName: null,
    metropolitanAreaName: null,
    micropolitanAreaName: null,
    countyPopulationEstimate: null,
    populationDensityPerSqMi: null,
    tractPopulationEstimate: null,
    tractLandSqMeters: null,
    tractPopulationDensityPerSqMi: null,
    blockGroupPopulationEstimate: null,
    blockGroupLandSqMeters: null,
    blockGroupPopulationDensityPerSqMi: null,
    geocoderTigerLineId: null,
    geocoderTigerLineSide: null,
    osmServiceDistances: null,
    nearestMajorHighwayStraightLineMiles: null,
    majorHighwayMitigationNote: null,
    distanceToPlaceCenterMiles: null,
    distanceToCbsaCenterMiles: null,
    nearestSubstationMiles: null,
    substationDataNote: null,
    comparableGeographyNote:
      "Comparable sales count, MLS days-on-market, concessions, and condition are not publicly verifiable here. Use MLS / licensed valuation data or county recorder research for Tier One liquidity tests.",
    warnings: [],
  };
}

/**
 * Attempt Census + ACS enrichment. Returns merged request fields and UI metadata.
 * Explicit user-provided request fields take precedence over enriched values.
 */
export async function enrichRuralAddress(
  addressLine: string,
  base: PropertyRuralRequestV1,
): Promise<{
  merged: PropertyRuralRequestV1;
  enrichment: RuralEnrichmentV1;
}> {
  const trimmed = addressLine.trim();
  const emptyEnrichment = emptyEnrichmentBase();

  if (!trimmed) {
    return {
      merged: base,
      enrichment: { ...emptyEnrichment, attempted: false },
    };
  }

  const warnings: string[] = [];
  const enc = encodeURIComponent(trimmed);

  let locationsParsed: unknown;
  let geographiesParsed: unknown;
  try {
    [locationsParsed, geographiesParsed] = await Promise.all([
      fetchJson(
        `${CENSUS_LOCATIONS}?address=${enc}&benchmark=Public_AR_Current&format=json`,
      ),
      fetchJson(
        `${CENSUS_GEOGRAPHIES}?address=${enc}&benchmark=Public_AR_Current&vintage=Current_Current&layers=${encodeURIComponent(GEO_LAYERS)}&format=json`,
      ),
    ]);
  } catch (e) {
    warnings.push(
      `Census Geocoder request failed (${e instanceof Error ? e.message : "unknown"}).`,
    );
    return {
      merged: { ...base, addressLabel: base.addressLabel ?? trimmed },
      enrichment: {
        ...emptyEnrichment,
        warnings,
      },
    };
  }

  const locResult = locationsParsed as {
    result?: {
      addressMatches?: Array<{
        matchedAddress?: string;
        coordinates?: { x: number; y: number };
        tigerLine?: { tigerLineId?: string; side?: string };
      }>;
    };
  };
  const geoResult = geographiesParsed as {
    result?: {
      addressMatches?: Array<{
        matchedAddress?: string;
        geographies?: Record<string, unknown[]>;
      }>;
    };
  };

  const locMatch = locResult.result?.addressMatches?.[0];
  const geoMatch = geoResult.result?.addressMatches?.[0];
  const coordinates = locMatch?.coordinates
    ? { lat: locMatch.coordinates.y, lon: locMatch.coordinates.x }
    : null;
  const matchedLine =
    locMatch?.matchedAddress?.trim() ||
    geoMatch?.matchedAddress ||
    null;
  const tigerLineId = locMatch?.tigerLine?.tigerLineId ?? null;
  const tigerLineSide = locMatch?.tigerLine?.side ?? null;

  if (!geoMatch?.geographies) {
    warnings.push(
      "Address could not be matched to Census geographies — try a fuller street address.",
    );
    return {
      merged: { ...base, addressLabel: base.addressLabel ?? matchedLine ?? trimmed },
      enrichment: {
        ...emptyEnrichment,
        matchedAddress: matchedLine,
        geocoderTigerLineId: tigerLineId,
        geocoderTigerLineSide: tigerLineSide,
        warnings,
      },
    };
  }

  const g = geoMatch.geographies;
  const state = firstGeo(g, "States");
  const county = firstGeo(g, "Counties");
  const place = firstGeo(g, "Incorporated Places");
  const tract = firstGeo(g, "Census Tracts");
  const blockGroup = firstGeo(g, "Census Block Groups");
  const urban = firstGeo(g, "Urban Areas");
  const metro = firstGeo(g, "Metropolitan Statistical Areas");
  const micro = firstGeo(g, "Micropolitan Statistical Areas");

  const stateFips = state?.GEOID ?? state?.STATE;
  const countyFips = county?.COUNTY;
  const tractGeoid = tract?.GEOID ?? null;
  const blockGroupGeoid = blockGroup?.GEOID ?? null;

  let countyPopulationEstimate: number | null = null;
  let populationDensityPerSqMi: number | null = null;

  if (
    stateFips &&
    countyFips &&
    county?.AREALAND &&
    /^\d+$/.test(String(stateFips)) &&
    /^\d+$/.test(String(countyFips))
  ) {
    try {
      const acsUrl = `${ACS5_BASE}?get=B01003_001E&for=county:${countyFips}&in=state:${stateFips}`;
      const pop = await acsPopulationCell(acsUrl);
      const landSqM = Number.parseFloat(String(county.AREALAND));
      if (pop !== null && Number.isFinite(landSqM) && landSqM > 0) {
        countyPopulationEstimate = pop;
        populationDensityPerSqMi = densityPerSqMi(pop, landSqM);
      }
    } catch {
      warnings.push("County population/density from Census ACS was unavailable.");
    }
  }

  let tractPopulationEstimate: number | null = null;
  let tractLandSqMeters: number | null = null;
  let tractPopulationDensityPerSqMi: number | null = null;
  let blockGroupPopulationEstimate: number | null = null;
  let blockGroupLandSqMeters: number | null = null;
  let blockGroupPopulationDensityPerSqMi: number | null = null;

  const tractLandRaw = tract?.AREALAND ? Number.parseFloat(String(tract.AREALAND)) : NaN;
  const bgLandRaw = blockGroup?.AREALAND
    ? Number.parseFloat(String(blockGroup.AREALAND))
    : NaN;
  if (tractGeoid && Number.isFinite(tractLandRaw) && tractLandRaw > 0) {
    tractLandSqMeters = tractLandRaw;
    const tParts = parseTractGeoidForAcs(tractGeoid);
    if (tParts) {
      const tUrl = `${ACS5_BASE}?get=B01003_001E&for=tract:${tParts.tract}&in=state:${tParts.state}+county:${tParts.county}`;
      tractPopulationEstimate = await acsPopulationCell(tUrl);
      if (tractPopulationEstimate !== null) {
        tractPopulationDensityPerSqMi = densityPerSqMi(
          tractPopulationEstimate,
          tractLandRaw,
        );
      }
    }
  }

  if (blockGroupGeoid && Number.isFinite(bgLandRaw) && bgLandRaw > 0) {
    blockGroupLandSqMeters = bgLandRaw;
    const bgParts = parseBlockGroupGeoidForAcs(blockGroupGeoid);
    if (bgParts) {
      const bgUrl = `${ACS5_BASE}?get=B01003_001E&for=block%20group:${encodeURIComponent(bgParts.blockGroup)}&in=state:${bgParts.state}+county:${bgParts.county}+tract:${bgParts.tract}`;
      blockGroupPopulationEstimate = await acsPopulationCell(bgUrl);
      if (blockGroupPopulationEstimate !== null) {
        blockGroupPopulationDensityPerSqMi = densityPerSqMi(
          blockGroupPopulationEstimate,
          bgLandRaw,
        );
      }
    }
  }

  let distanceToPlaceCenterMiles: number | null = null;
  let distanceToCbsaCenterMiles: number | null = null;
  if (coordinates) {
    const plat = parseCoord(place?.INTPTLAT);
    const plon = parseCoord(place?.INTPTLON);
    if (plat !== null && plon !== null) {
      distanceToPlaceCenterMiles = haversineMiles(
        coordinates.lat,
        coordinates.lon,
        plat,
        plon,
      );
    }
    const cbsa = metro ?? micro;
    const clat = parseCoord(cbsa?.INTPTLAT);
    const clon = parseCoord(cbsa?.INTPTLON);
    if (clat !== null && clon !== null) {
      distanceToCbsaCenterMiles = haversineMiles(
        coordinates.lat,
        coordinates.lon,
        clat,
        clon,
      );
    }
  }

  let nearestSubstationMiles: number | null = null;
  let substationDataNote: string | null = null;
  let osmServiceDistances: RuralOsmServiceDistancesV1 | null = null;
  let nearestMajorHighwayStraightLineMiles: number | null = null;
  let majorHighwayMitigationNote: string | null = null;

  if (coordinates) {
    try {
      const q = `[out:json][timeout:18];(node["power"="substation"](around:80000,${coordinates.lat},${coordinates.lon}););out body 12;`;
      const overRes = await fetch(OVERPASS, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": USER_AGENT,
        },
        body: `data=${encodeURIComponent(q)}`,
        signal: AbortSignal.timeout(22_000),
      });
      if (overRes.ok) {
        const overJson = (await overRes.json()) as {
          elements?: Array<{ lat?: number; lon?: number; tags?: Record<string, string> }>;
        };
        const els = overJson.elements ?? [];
        let best: number | null = null;
        let sawTraction = false;
        for (const el of els) {
          if (typeof el.lat !== "number" || typeof el.lon !== "number") {
            continue;
          }
          const d = haversineMiles(
            coordinates.lat,
            coordinates.lon,
            el.lat,
            el.lon,
          );
          const traction = el.tags?.substation === "traction";
          if (traction) {
            sawTraction = true;
          }
          if (best === null || d < best) {
            best = d;
          }
        }
        nearestSubstationMiles = best;
        substationDataNote =
          sawTraction && best !== null
            ? "Nearest mapped substation may include rail/traction infrastructure — verify with local utility maps for grid service."
            : "OpenStreetMap substation locations are incomplete in many rural areas; distances are indicative only.";
      }
    } catch {
      warnings.push("OpenStreetMap utility distance lookup timed out or failed.");
    }

    try {
      osmServiceDistances = await fetchOsmServiceDistances(
        coordinates.lat,
        coordinates.lon,
      );
    } catch {
      warnings.push("OpenStreetMap amenity distance lookup timed out or failed.");
      osmServiceDistances = {
        nearestPostOfficeStraightLineMiles: null,
        nearestHospitalOrUrgentStraightLineMiles: null,
        nearestSchoolStraightLineMiles: null,
        nearestGroceryOrMajorRetailStraightLineMiles: null,
        sourceNote: "OSM service query failed.",
      };
    }

    try {
      const hw = await fetchNearestMajorHighwayMiles(
        coordinates.lat,
        coordinates.lon,
      );
      nearestMajorHighwayStraightLineMiles = hw.miles;
      majorHighwayMitigationNote = hw.note;
    } catch {
      warnings.push("OpenStreetMap highway proximity lookup failed.");
    }
  }

  const inMetropolitan = metro !== null;
  const enrichment: RuralEnrichmentV1 = {
    attempted: true,
    matchedAddress: matchedLine ?? place?.NAME ?? county?.NAME ?? trimmed,
    coordinates,
    censusTractGeoid: tractGeoid,
    censusBlockGroupGeoid: blockGroupGeoid,
    countyName: county?.NAME ?? county?.BASENAME ?? null,
    stateAbbr: state?.STUSAB ?? null,
    placeName: place?.NAME ?? null,
    urbanAreaName: urban?.NAME ?? null,
    metropolitanAreaName: metro?.NAME ?? null,
    micropolitanAreaName: micro?.NAME ?? null,
    countyPopulationEstimate,
    populationDensityPerSqMi,
    tractPopulationEstimate,
    tractLandSqMeters,
    tractPopulationDensityPerSqMi,
    blockGroupPopulationEstimate,
    blockGroupLandSqMeters,
    blockGroupPopulationDensityPerSqMi,
    geocoderTigerLineId: tigerLineId,
    geocoderTigerLineSide: tigerLineSide,
    osmServiceDistances,
    nearestMajorHighwayStraightLineMiles,
    majorHighwayMitigationNote,
    distanceToPlaceCenterMiles,
    distanceToCbsaCenterMiles,
    nearestSubstationMiles,
    substationDataNote,
    comparableGeographyNote:
      "Comparable sales count, MLS days-on-market, concessions, and condition are not publicly verifiable here. Use MLS / licensed valuation data or county recorder research for Tier One liquidity tests.",
    warnings,
  };

  const merged: PropertyRuralRequestV1 = {
    ...base,
    addressLabel:
      base.addressLabel?.trim() ||
      matchedLine ||
      place?.NAME ||
      county?.NAME ||
      trimmed,
    state: base.state ?? state?.STUSAB,
    county: base.county ?? (county?.NAME ?? county?.BASENAME),
    municipality: base.municipality ?? place?.NAME,
    population: base.population ?? countyPopulationEstimate ?? undefined,
    isInMsa: base.isInMsa ?? inMetropolitan,
    userProvidedRuralIndicator: base.userProvidedRuralIndicator,
  };

  return { merged, enrichment };
}
