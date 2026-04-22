"use client";

import { useCallback, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import type {
  PropertyRuralResponseV1,
  RuralCheckResult,
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

function verdictLabel(result: RuralCheckResult): string {
  switch (result) {
    case "likely_rural":
      return "Likely rural";
    case "likely_not_rural":
      return "Not likely rural";
    case "needs_review":
      return "Review suggested";
    case "insufficient_info":
      return "Insufficient information";
    default: {
      const _x: never = result;
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
          Enter a U.S. address to pull Census population and CBSA context, optional
          utility distance from OpenStreetMap, and a scored &quot;likely rural&quot; /
          &quot;not likely rural&quot; read from published rural_rules. Not a final
          determination — escalate borderline cases.
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
            Uses U.S. Census Geocoder + ACS (county population, density). MSA flag is
            set when the address falls in a metropolitan CBSA.
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
              {verdictLabel(response.result)}
            </p>
            <p className="mt-1 text-sm opacity-90">
              Confidence: <span className="font-medium">{response.certainty}</span> ·
              Engine:{" "}
              <span className="font-mono text-xs">{response.result}</span>
            </p>
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
                    Population density (county)
                  </dt>
                  <dd>{formatDensity(en.populationDensityPerSqMi)}</dd>
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
