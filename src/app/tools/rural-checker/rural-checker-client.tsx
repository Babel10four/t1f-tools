"use client";

import { useCallback, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { ruralScreeningHeading } from "@/lib/engines/property/rural-evidence-report";
import type {
  PropertyRuralResponseV1,
  RuralCheckResult,
  RuralEvidenceCriterionStatus,
} from "@/lib/engines/property/rural-types";

type TriState = "" | "true" | "false";

function triToBool(v: TriState): boolean | undefined {
  if (v === "") {
    return undefined;
  }
  return v === "true";
}

function formatMi(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) {
    return "—";
  }
  return `${n.toFixed(1)} mi`;
}

function formatDensity(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) {
    return "—";
  }
  return `${Math.round(n).toLocaleString()} / mi²`;
}

function criterionBadgeClass(status: RuralEvidenceCriterionStatus): string {
  switch (status) {
    case "meets_rural_signal":
      return "bg-amber-100 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100";
    case "meets_not_rural_signal":
      return "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100";
    case "inconclusive":
      return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";
    case "public_data_unavailable":
      return "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200";
    default: {
      const _x: never = status;
      return _x;
    }
  }
}

function verdictStyles(result: RuralCheckResult): string {
  switch (result) {
    case "likely_rural":
      return "border-[var(--brand)] bg-[var(--brand-muted)] text-[var(--brand)]";
    case "likely_not_rural":
      return "border-zinc-300 bg-zinc-100 text-zinc-900";
    case "needs_review":
      return "border-amber-300 bg-amber-50 text-amber-950";
    case "insufficient_info":
      return "border-zinc-200 bg-zinc-50 text-zinc-700";
    default: {
      const _x: never = result;
      return _x;
    }
  }
}

/**
 * Rural Checker — POST /api/property/rural. Optional Census address enrichment.
 */
export function RuralCheckerClient() {
  const [addressLine, setAddressLine] = useState("");
  const [addressLabel, setAddressLabel] = useState("");
  const [state, setState] = useState("");
  const [county, setCounty] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [population, setPopulation] = useState("");
  const [isInMsa, setIsInMsa] = useState<TriState>("");
  const [userRural, setUserRural] = useState<TriState>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<PropertyRuralResponseV1 | null>(null);

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);
      setResponse(null);
      setSubmitting(true);
      const body: Record<string, unknown> = {};
      if (addressLine.trim()) {
        body.addressLine = addressLine.trim();
      }
      if (addressLabel.trim()) {
        body.addressLabel = addressLabel.trim();
      }
      if (state.trim()) {
        body.state = state.trim();
      }
      if (county.trim()) {
        body.county = county.trim();
      }
      if (municipality.trim()) {
        body.municipality = municipality.trim();
      }
      if (population.trim()) {
        const n = Number(population);
        if (!Number.isFinite(n)) {
          setError("Population must be a valid number.");
          setSubmitting(false);
          return;
        }
        body.population = n;
      }
      const msa = triToBool(isInMsa);
      if (msa !== undefined) {
        body.isInMsa = msa;
      }
      const ur = triToBool(userRural);
      if (ur !== undefined) {
        body.userProvidedRuralIndicator = ur;
      }

      try {
        const res = await fetch("/api/property/rural", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const text = await res.text();
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = undefined;
        }
        if (!res.ok) {
          const err =
            parsed &&
            typeof parsed === "object" &&
            parsed !== null &&
            "error" in parsed &&
            typeof (parsed as { error?: unknown }).error === "string"
              ? (parsed as { error: string }).error
              : `Request failed (${res.status})`;
          setError(err);
          return;
        }
        if (parsed && typeof parsed === "object" && parsed !== null) {
          setResponse(parsed as PropertyRuralResponseV1);
        }
      } catch {
        setError("Network error.");
      } finally {
        setSubmitting(false);
      }
    },
    [
      addressLabel,
      addressLine,
      county,
      isInMsa,
      municipality,
      population,
      state,
      userRural,
    ],
  );

  const onPop = (e: ChangeEvent<HTMLInputElement>) => {
    setPopulation(e.target.value);
  };

  const en = response?.enrichment;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          Rural Eligibility Checker
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--text-muted)]">
          Enter a U.S. address for a criterion-by-criterion rural evidence report (Census
          geocoder + ACS tract/block-group density, OSM service and highway distances)
          alongside the published{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-900">
            rural_rules
          </code>{" "}
          score. Outcomes use Tier One–style headings (Likely Rural / Out of Policy,
          Likely Not Rural, Manual UW Review Required). MLS comps and DOM are not
          automated — see the evidence matrix.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="flex max-w-xl flex-col gap-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-chrome)] p-6 shadow-sm"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-[var(--text-primary)]">
            Street address (recommended)
          </span>
          <input
            className="rounded-md border border-[var(--border-subtle)] bg-white px-3 py-2 text-[var(--text-primary)] placeholder:text-zinc-400"
            value={addressLine}
            onChange={(e) => setAddressLine(e.target.value)}
            disabled={submitting}
            autoComplete="street-address"
            placeholder="e.g. 100 Main St, Montpelier, VT 05602"
          />
          <span className="text-xs text-[var(--text-muted)]">
            Uses Census Geocoder + ACS (county totals; tract and block-group density
            when matched). OSM Overpass for amenities and major highways
            (straight-line). MSA flag follows metropolitan CBSA membership.
          </span>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-[var(--text-primary)]">
            Note label (optional)
          </span>
          <input
            className="rounded-md border border-[var(--border-subtle)] bg-white px-3 py-2 text-[var(--text-primary)]"
            value={addressLabel}
            onChange={(e) => setAddressLabel(e.target.value)}
            disabled={submitting}
            autoComplete="off"
            placeholder="Internal reference only"
          />
        </label>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
          Or enter signals manually (overrides auto-filled fields below when provided)
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-[var(--text-primary)]">State</span>
            <input
              className="rounded-md border border-[var(--border-subtle)] bg-white px-3 py-2 text-[var(--text-primary)]"
              value={state}
              onChange={(e) => setState(e.target.value)}
              disabled={submitting}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-[var(--text-primary)]">County</span>
            <input
              className="rounded-md border border-[var(--border-subtle)] bg-white px-3 py-2 text-[var(--text-primary)]"
              value={county}
              onChange={(e) => setCounty(e.target.value)}
              disabled={submitting}
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-[var(--text-primary)]">Municipality</span>
          <input
            className="rounded-md border border-[var(--border-subtle)] bg-white px-3 py-2 text-[var(--text-primary)]"
            value={municipality}
            onChange={(e) => setMunicipality(e.target.value)}
            disabled={submitting}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-[var(--text-primary)]">Population</span>
          <input
            type="text"
            inputMode="numeric"
            className="rounded-md border border-[var(--border-subtle)] bg-white px-3 py-2 text-[var(--text-primary)]"
            value={population}
            onChange={onPop}
            disabled={submitting}
            placeholder="Leave blank to use ACS county total when address is provided"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-[var(--text-primary)]">In MSA</span>
          <select
            className="rounded-md border border-[var(--border-subtle)] bg-white px-3 py-2 text-[var(--text-primary)]"
            value={isInMsa}
            onChange={(e) => setIsInMsa(e.target.value as TriState)}
            disabled={submitting}
          >
            <option value="">Auto / not specified</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-[var(--text-primary)]">
            User: location is rural
          </span>
          <select
            className="rounded-md border border-[var(--border-subtle)] bg-white px-3 py-2 text-[var(--text-primary)]"
            value={userRural}
            onChange={(e) => setUserRural(e.target.value as TriState)}
            disabled={submitting}
          >
            <option value="">Not specified</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="mt-2 inline-flex items-center justify-center rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-hover)] disabled:opacity-60"
        >
          {submitting ? "Running…" : "Run screening"}
        </button>
      </form>

      {error ? (
        <div
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {response ? (
        <div className="flex max-w-2xl flex-col gap-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-chrome)] p-6 shadow-sm">
          <div
            className={`rounded-lg border-2 px-4 py-3 ${verdictStyles(response.result)}`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
              Screening outcome
            </p>
            <p className="mt-1 text-xl font-semibold tracking-tight">
              {ruralScreeningHeading(response)}
            </p>
            <p className="mt-1 text-sm opacity-90">
              Confidence: <span className="font-medium">{response.certainty}</span> ·
              Engine:{" "}
              <span className="font-mono text-xs">{response.result}</span>
            </p>
            {response.evidenceReport ? (
              <p className="mt-2 border-t border-black/10 pt-2 text-sm opacity-95 dark:border-white/10">
                {response.evidenceReport.coreRuralIndicatorsSummary}
              </p>
            ) : null}
          </div>

          {en?.attempted ? (
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-page)] p-4 text-sm">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Address &amp; geography
              </h3>
              <dl className="mt-3 grid gap-2 text-[var(--text-muted)] sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase">Matched</dt>
                  <dd className="text-[var(--text-primary)]">
                    {en.matchedAddress ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase">Tract (GEOID)</dt>
                  <dd className="font-mono text-xs text-[var(--text-primary)]">
                    {en.censusTractGeoid ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase">Place</dt>
                  <dd>{en.placeName ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase">County</dt>
                  <dd>{en.countyName ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase">Urban area</dt>
                  <dd>{en.urbanAreaName ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase">Metro / micro</dt>
                  <dd>
                    {en.metropolitanAreaName ?? "—"}
                    {en.micropolitanAreaName ? (
                      <span className="block text-xs">
                        Micro: {en.micropolitanAreaName}
                      </span>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase">
                    County population (ACS)
                  </dt>
                  <dd>
                    {en.countyPopulationEstimate != null
                      ? en.countyPopulationEstimate.toLocaleString()
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase">
                    Population density (tract — Tier One primary)
                  </dt>
                  <dd>{formatDensity(en.tractPopulationDensityPerSqMi)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase">
                    Population density (block group)
                  </dt>
                  <dd>{formatDensity(en.blockGroupPopulationDensityPerSqMi)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase">
                    Population density (county, coarse)
                  </dt>
                  <dd>{formatDensity(en.populationDensityPerSqMi)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase">
                    Block group (GEOID)
                  </dt>
                  <dd className="font-mono text-xs text-[var(--text-primary)]">
                    {en.censusBlockGroupGeoid ?? "—"}
                  </dd>
                </div>
                {en.osmServiceDistances ? (
                  <>
                    <div>
                      <dt className="text-xs font-medium uppercase">
                        Nearest post office (OSM, straight-line)
                      </dt>
                      <dd>
                        {formatMi(en.osmServiceDistances.nearestPostOfficeStraightLineMiles)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium uppercase">
                        Nearest hospital / clinic (OSM)
                      </dt>
                      <dd>
                        {formatMi(
                          en.osmServiceDistances.nearestHospitalOrUrgentStraightLineMiles,
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium uppercase">Nearest school (OSM)</dt>
                      <dd>
                        {formatMi(en.osmServiceDistances.nearestSchoolStraightLineMiles)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium uppercase">
                        Nearest major retail (OSM)
                      </dt>
                      <dd>
                        {formatMi(
                          en.osmServiceDistances.nearestGroceryOrMajorRetailStraightLineMiles,
                        )}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-xs font-medium uppercase">OSM caveat</dt>
                      <dd className="text-xs">{en.osmServiceDistances.sourceNote}</dd>
                    </div>
                  </>
                ) : null}
                <div>
                  <dt className="text-xs font-medium uppercase">
                    Nearest motorway/trunk (OSM, straight-line)
                  </dt>
                  <dd>
                    {formatMi(en.nearestMajorHighwayStraightLineMiles)}
                    {en.majorHighwayMitigationNote ? (
                      <span className="mt-1 block text-xs text-[var(--text-muted)]">
                        {en.majorHighwayMitigationNote}
                      </span>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase">
                    Distance to place centroid
                  </dt>
                  <dd>{formatMi(en.distanceToPlaceCenterMiles)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase">
                    Distance to CBSA center
                  </dt>
                  <dd>{formatMi(en.distanceToCbsaCenterMiles)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase">
                    Nearest mapped substation (OSM)
                  </dt>
                  <dd>
                    {formatMi(en.nearestSubstationMiles)}
                    {en.substationDataNote ? (
                      <span className="mt-1 block text-xs text-[var(--text-muted)]">
                        {en.substationDataNote}
                      </span>
                    ) : null}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 border-t border-[var(--border-subtle)] pt-3 text-xs text-[var(--text-muted)]">
                {en.comparableGeographyNote}
              </p>
            </div>
          ) : null}

          {response.evidenceReport ? (
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-page)] p-4 text-sm">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Rural evidence matrix (public data)
              </h3>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Rules + evidence matrix — not an auto-approval. USDA RD maps are not
                used as the Tier One determination here.
              </p>
              <ul className="mt-3 flex flex-col gap-3">
                {response.evidenceReport.criteria.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-md border border-[var(--border-subtle)] bg-white p-3 dark:bg-zinc-950"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-[var(--text-primary)]">
                        {c.title}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${criterionBadgeClass(c.status)}`}
                      >
                        {c.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="mt-2 text-[var(--text-muted)]">{c.narrative}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      <span className="font-medium text-[var(--text-primary)]">
                        Sources:{" "}
                      </span>
                      {c.sources.join("; ")}
                    </p>
                    {c.limitation ? (
                      <p className="mt-1 text-xs text-amber-900/90 dark:text-amber-200/90">
                        <span className="font-medium">Limitation: </span>
                        {c.limitation}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
              {response.evidenceReport.mitigants.length > 0 ? (
                <div className="mt-4 border-t border-[var(--border-subtle)] pt-3">
                  <h4 className="text-xs font-semibold uppercase text-[var(--text-muted)]">
                    Mitigants
                  </h4>
                  <ul className="mt-2 list-inside list-disc text-[var(--text-muted)]">
                    {response.evidenceReport.mitigants.map((m) => (
                      <li key={m.label}>
                        <span className="font-medium text-[var(--text-primary)]">
                          {m.label}:{" "}
                        </span>
                        {m.detail}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="mt-4 border-t border-[var(--border-subtle)] pt-3">
                <h4 className="text-xs font-semibold uppercase text-[var(--text-muted)]">
                  Data limitations
                </h4>
                <ul className="mt-2 list-inside list-disc text-xs text-[var(--text-muted)]">
                  {response.evidenceReport.dataLimitations.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </div>
              <p className="mt-4 rounded-md bg-zinc-100 p-3 text-xs text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                <span className="font-semibold text-[var(--text-primary)]">
                  Suggested UW action:{" "}
                </span>
                {response.evidenceReport.suggestedUwAction}
              </p>
            </div>
          ) : null}

          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Reasons
            </h2>
            {response.reasons.length > 0 ? (
              <ul className="mt-1 list-inside list-disc text-sm text-[var(--text-muted)]">
                {response.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-[var(--text-muted)]">—</p>
            )}
          </div>
          {response.warnings.length > 0 ? (
            <div>
              <h3 className="text-sm font-medium text-amber-900">Warnings</h3>
              <ul className="mt-1 list-inside list-disc text-sm text-amber-900/90">
                {response.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="grid gap-2 text-sm text-[var(--text-muted)]">
            <p>
              <span className="font-medium text-[var(--text-primary)]">
                Rule set:{" "}
              </span>
              {response.ruleSet
                ? `${response.ruleSet.versionLabel} (${response.ruleSet.id})`
                : "—"}
            </p>
            <p>
              <span className="font-medium text-[var(--text-primary)]">
                Rural policy doc:{" "}
              </span>
              {response.ruralPolicy
                ? `${response.ruralPolicy.title} — ${response.ruralPolicy.versionLabel}`
                : "—"}
            </p>
          </div>
          <p className="border-t border-[var(--border-subtle)] pt-4 text-xs text-[var(--text-muted)]">
            {response.disclaimer}
          </p>
        </div>
      ) : null}
    </div>
  );
}
