/**
 * Optional address enrichment for Rural Checker — Census Geocoder + ACS + OSM (TICKET-008 extension).
 * Not a legal determination; external data may be incomplete or stale.
 */
import type { PropertyRuralRequestV1, RuralEnrichmentV1 } from "./rural-types";

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
  "States",
].join(",");

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
  const emptyEnrichment: RuralEnrichmentV1 = {
    attempted: true,
    matchedAddress: null,
    coordinates: null,
    censusTractGeoid: null,
    countyName: null,
    stateAbbr: null,
    placeName: null,
    urbanAreaName: null,
    metropolitanAreaName: null,
    micropolitanAreaName: null,
    countyPopulationEstimate: null,
    populationDensityPerSqMi: null,
    distanceToPlaceCenterMiles: null,
    distanceToCbsaCenterMiles: null,
    nearestSubstationMiles: null,
    substationDataNote: null,
    comparableGeographyNote:
      "Automated MLS-style sales comps are not included. Census tract and county identify geographic context for manual research.",
    warnings: [],
  };

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
    result?: { addressMatches?: Array<{ coordinates?: { x: number; y: number } }> };
  };
  const geoResult = geographiesParsed as {
    result?: {
      addressMatches?: Array<{
        matchedAddress?: string;
        geographies?: Record<string, unknown[]>;
      }>;
    };
  };

  const locMatch = locResult.result?.addressMatches?.[0] as
    | { matchedAddress?: string; coordinates?: { x: number; y: number } }
    | undefined;
  const geoMatch = geoResult.result?.addressMatches?.[0];
  const coordinates = locMatch?.coordinates
    ? { lat: locMatch.coordinates.y, lon: locMatch.coordinates.x }
    : null;
  const matchedLine =
    locMatch?.matchedAddress?.trim() ||
    geoMatch?.matchedAddress ||
    null;

  if (!geoMatch?.geographies) {
    warnings.push(
      "Address could not be matched to Census geographies — try a fuller street address.",
    );
    return {
      merged: { ...base, addressLabel: base.addressLabel ?? matchedLine ?? trimmed },
      enrichment: {
        ...emptyEnrichment,
        matchedAddress: matchedLine,
        warnings,
      },
    };
  }

  const g = geoMatch.geographies;
  const state = firstGeo(g, "States");
  const county = firstGeo(g, "Counties");
  const place = firstGeo(g, "Incorporated Places");
  const tract = firstGeo(g, "Census Tracts");
  const urban = firstGeo(g, "Urban Areas");
  const metro = firstGeo(g, "Metropolitan Statistical Areas");
  const micro = firstGeo(g, "Micropolitan Statistical Areas");

  const stateFips = state?.GEOID ?? state?.STATE;
  const countyFips = county?.COUNTY;

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
      const acs = (await fetchJson(acsUrl)) as unknown[];
      const row = Array.isArray(acs) && acs.length >= 2 ? acs[1] : null;
      const popStr = Array.isArray(row) ? row[0] : null;
      const pop = typeof popStr === "string" ? Number.parseInt(popStr, 10) : NaN;
      const landSqM = Number.parseFloat(String(county.AREALAND));
      if (Number.isFinite(pop) && Number.isFinite(landSqM) && landSqM > 0) {
        countyPopulationEstimate = pop;
        const sqMi = landSqM / 2_589_988.110336;
        populationDensityPerSqMi = pop / sqMi;
      }
    } catch {
      warnings.push("County population/density from Census ACS was unavailable.");
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
  }

  const inMetropolitan = metro !== null;
  const enrichment: RuralEnrichmentV1 = {
    attempted: true,
    matchedAddress: matchedLine ?? place?.NAME ?? county?.NAME ?? trimmed,
    coordinates,
    censusTractGeoid: tract?.GEOID ?? null,
    countyName: county?.NAME ?? county?.BASENAME ?? null,
    stateAbbr: state?.STUSAB ?? null,
    placeName: place?.NAME ?? null,
    urbanAreaName: urban?.NAME ?? null,
    metropolitanAreaName: metro?.NAME ?? null,
    micropolitanAreaName: micro?.NAME ?? null,
    countyPopulationEstimate,
    populationDensityPerSqMi,
    distanceToPlaceCenterMiles,
    distanceToCbsaCenterMiles,
    nearestSubstationMiles,
    substationDataNote,
    comparableGeographyNote:
      "Automated MLS-style sales comps are not included. Census tract and county identify geographic context for manual research.",
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
