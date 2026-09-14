"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { ToolPageHeader } from "@/components/tools/tool-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  calculateLoanCalculator,
  validateLoanCalculatorInput,
} from "@/lib/loan-calculator/calculate";
import {
  isPurchasePurpose,
  LOAN_CALCULATOR_POLICY_VERSION,
  LOAN_CALCULATOR_WORKBOOK_VERSION,
  SUPPORTED_STATES,
} from "@/lib/loan-calculator/rules";
import type {
  EligibilityResult,
  LoanCalculatorInput,
  LoanCalculatorResult,
  LoanPurpose,
  PropertyType,
  ValidationIssue,
} from "@/lib/loan-calculator/types";

type MarketCity = {
  state: string;
  regionId: number;
  city: string;
  periodEnd: string;
  monthsOfSupply: number;
};

type MarketResponse = {
  snapshot: { lastUpdated: string; dataThrough: string };
  cities: MarketCity[];
};

type CalculatorFields = {
  state: string;
  borrowerTier: string;
  flipsCompletedWithT1f: string;
  fico: string;
  purpose: LoanPurpose;
  propertyType: PropertyType;
  constructionAdvanceExposure: string;
  virtualInspectionExposure: string;
  city: string;
  purchasePrice: string;
  assignmentFees: string;
  sellerConcessions: string;
  documentedImprovements: string;
  rehabBudget: string;
  rehabHoldback: string;
  arv: string;
  asIsValue: string;
  requestedLtcPercent: string;
  requestedPointsPercent: string;
};

const EMPTY_FIELDS: CalculatorFields = {
  state: "",
  borrowerTier: "",
  flipsCompletedWithT1f: "",
  fico: "",
  purpose: "purchase_with_rehab",
  propertyType: "sfr",
  constructionAdvanceExposure: "0",
  virtualInspectionExposure: "0",
  city: "",
  purchasePrice: "",
  assignmentFees: "0",
  sellerConcessions: "0",
  documentedImprovements: "0",
  rehabBudget: "",
  rehabHoldback: "",
  arv: "",
  asIsValue: "",
  requestedLtcPercent: "",
  requestedPointsPercent: "",
};

const INPUT_CLASS =
  "w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-chrome)] px-3 py-2.5 text-sm text-[var(--text-primary)] shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-muted)]";

function parseNumber(value: string): number {
  if (value.trim() === "") return 0;
  return Number(value.replace(/[$,%\s,]/g, ""));
}

function formatMoney(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "Not applicable";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatRatio(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "Not applicable";
  return `${(value * 100).toFixed(2).replace(/\.00$/, "")}%`;
}

function formatRate(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "Exception required";
  return `${value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}%`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

function Field({
  id,
  label,
  hint,
  required,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-[var(--text-primary)]">
        {label} {required ? <span className="text-red-600">*</span> : null}
      </label>
      {children}
      {hint ? <p className="text-xs leading-5 text-[var(--text-muted)]">{hint}</p> : null}
    </div>
  );
}

function SectionHeading({ number, title, copy }: { number: string; title: string; copy: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--brand-muted)] text-xs font-bold text-[var(--brand)]">
        {number}
      </span>
      <div>
        <h2 className="font-semibold tracking-tight text-[var(--text-primary)]">{title}</h2>
        <p className="mt-0.5 text-sm leading-5 text-[var(--text-muted)]">{copy}</p>
      </div>
    </div>
  );
}

function ResultMetric({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </dt>
      <dd
        className={
          emphasis
            ? "mt-1 text-xl font-semibold tracking-tight text-[var(--brand)]"
            : "mt-1 text-base font-semibold text-[var(--text-primary)]"
        }
      >
        {value}
      </dd>
    </div>
  );
}

function EligibilityPanel({ title, result }: { title: string; result: EligibilityResult }) {
  return (
    <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-chrome)] p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-[var(--text-primary)]">{title}</h3>
        <span
          className={
            result.eligible
              ? "rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800"
              : "rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800"
          }
        >
          {result.eligible ? "Eligible" : "Not eligible"}
        </span>
      </div>
      <ul className="mt-3 divide-y divide-[var(--border-subtle)] text-xs">
        {result.checks.map((check) => (
          <li key={check.key} className="grid grid-cols-[1fr_auto] gap-3 py-2.5">
            <div>
              <p className="font-medium text-[var(--text-primary)]">{check.label}</p>
              <p className="mt-0.5 text-[var(--text-muted)]">Needs {check.requirement}</p>
            </div>
            <span className={check.passed ? "font-semibold text-emerald-700" : "font-semibold text-red-700"}>
              {check.actual}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function buildInput(fields: CalculatorFields, city: MarketCity): LoanCalculatorInput {
  const purchase = isPurchasePurpose(fields.purpose);
  const withRehab = fields.purpose === "purchase_with_rehab";
  const requestedLtc = parseNumber(fields.requestedLtcPercent);
  const requestedPoints = parseNumber(fields.requestedPointsPercent);

  return {
    state: fields.state,
    borrowerTier: parseNumber(fields.borrowerTier) as LoanCalculatorInput["borrowerTier"],
    flipsCompletedWithT1f: parseNumber(fields.flipsCompletedWithT1f),
    fico: parseNumber(fields.fico),
    purpose: fields.purpose,
    propertyType: fields.propertyType,
    constructionAdvanceExposure: parseNumber(fields.constructionAdvanceExposure),
    virtualInspectionExposure: parseNumber(fields.virtualInspectionExposure),
    city: city.city,
    monthsOfSupply: city.monthsOfSupply,
    purchasePrice: purchase ? parseNumber(fields.purchasePrice) : 0,
    assignmentFees: purchase ? parseNumber(fields.assignmentFees) : 0,
    sellerConcessions: purchase ? parseNumber(fields.sellerConcessions) : 0,
    documentedImprovements: purchase ? parseNumber(fields.documentedImprovements) : 0,
    rehabBudget: withRehab ? parseNumber(fields.rehabBudget) : 0,
    rehabHoldback: withRehab ? parseNumber(fields.rehabHoldback) : 0,
    arv: purchase ? parseNumber(fields.arv) : 0,
    asIsValue: purchase ? 0 : parseNumber(fields.asIsValue),
    requestedLtc:
      purchase && requestedLtc > 0 ? requestedLtc / 100 : undefined,
    requestedPoints:
      fields.requestedPointsPercent.trim() === "" ? undefined : requestedPoints / 100,
  };
}

export function LoanCalculatorClient() {
  const [fields, setFields] = useState<CalculatorFields>(EMPTY_FIELDS);
  const [cities, setCities] = useState<MarketCity[]>([]);
  const [snapshot, setSnapshot] = useState<MarketResponse["snapshot"] | null>(null);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [result, setResult] = useState<LoanCalculatorResult | null>(null);

  const selectedCity = useMemo(() => {
    const normalized = fields.city.trim().toLowerCase();
    if (!normalized) return undefined;
    return cities.find((city) => city.city.toLowerCase() === normalized);
  }, [cities, fields.city]);

  useEffect(() => {
    if (!fields.state) return;
    const controller = new AbortController();
    fetch(`/api/market/months-of-supply?state=${encodeURIComponent(fields.state)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Market data could not be loaded.");
        return (await response.json()) as MarketResponse;
      })
      .then((payload) => {
        setCities(payload.cities);
        setSnapshot(payload.snapshot);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setCities([]);
        setSnapshot(null);
        setMarketError(error instanceof Error ? error.message : "Market data could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setMarketLoading(false);
      });
    return () => controller.abort();
  }, [fields.state]);

  const updateField =
    (key: keyof CalculatorFields) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = event.target.value;
      setFields((current) => ({ ...current, [key]: value }));
      setIssues([]);
      setResult(null);
    };

  const updateState = (event: ChangeEvent<HTMLSelectElement>) => {
    const state = event.target.value;
    setFields((current) => ({ ...current, state, city: "" }));
    setCities([]);
    setSnapshot(null);
    setMarketLoading(Boolean(state));
    setMarketError(null);
    setIssues([]);
    setResult(null);
  };

  const updatePurpose = (event: ChangeEvent<HTMLSelectElement>) => {
    const purpose = event.target.value as LoanPurpose;
    setFields((current) => ({
      ...current,
      purpose,
      rehabBudget: purpose === "purchase_with_rehab" ? current.rehabBudget : "0",
      rehabHoldback: purpose === "purchase_with_rehab" ? current.rehabHoldback : "0",
    }));
    setIssues([]);
    setResult(null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCity) {
      setIssues([{ field: "city", message: "Select an eligible city from the market data list." }]);
      setResult(null);
      return;
    }
    const input = buildInput(fields, selectedCity);
    const nextIssues = validateLoanCalculatorInput(input);
    setIssues(nextIssues);
    setResult(nextIssues.length === 0 ? calculateLoanCalculator(input) : null);
  };

  const purchase = isPurchasePurpose(fields.purpose);
  const withRehab = fields.purpose === "purchase_with_rehab";

  return (
    <div className="flex flex-col gap-8">
      <ToolPageHeader
        href="/tools/loan-calculator"
        disclosure={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3 text-xs text-[var(--text-muted)]">
            <span className="font-semibold text-[var(--text-primary)]">
              Policy effective {formatDate(LOAN_CALCULATOR_POLICY_VERSION)}
            </span>
            <span aria-hidden>•</span>
            <span>Calculator updated {formatDate(LOAN_CALCULATOR_WORKBOOK_VERSION)}</span>
            <span aria-hidden>•</span>
            <span>Internal scenario guidance only; final approval remains subject to underwriting.</span>
          </div>
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(360px,0.88fr)]">
        <form className="flex flex-col gap-5" onSubmit={handleSubmit} data-testid="loan-calculator-form">
          {issues.length > 0 ? (
            <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              <p className="font-semibold">Review these inputs</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {issues.map((issue, index) => (
                  <li key={`${issue.field}-${index}`}>{issue.message}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <Card className="flex flex-col gap-5">
            <SectionHeading
              number="1"
              title="Borrower and property"
              copy="Set the borrower profile and choose the market for this property."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="calculator-state" label="Property state" required>
                <select id="calculator-state" value={fields.state} onChange={updateState} className={INPUT_CLASS}>
                  <option value="">Select a state</option>
                  {SUPPORTED_STATES.map((state) => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </Field>
              <Field id="calculator-city" label="City" required hint={snapshot ? `Market data through ${formatDate(snapshot.dataThrough)}` : undefined}>
                <input
                  id="calculator-city"
                  list="calculator-city-options"
                  value={fields.city}
                  onChange={updateField("city")}
                  disabled={!fields.state || marketLoading}
                  placeholder={marketLoading ? "Loading cities…" : fields.state ? "Start typing a city" : "Choose a state first"}
                  autoComplete="off"
                  className={INPUT_CLASS}
                />
                <datalist id="calculator-city-options">
                  {cities.map((city) => <option key={city.regionId} value={city.city} />)}
                </datalist>
                {marketError ? <p className="text-xs text-red-700">{marketError}</p> : null}
                {selectedCity ? (
                  <p className="text-xs font-semibold text-[var(--brand)]">
                    {selectedCity.monthsOfSupply.toFixed(1)} months of supply · period ending {formatDate(selectedCity.periodEnd)}
                  </p>
                ) : null}
              </Field>
              <Field id="calculator-tier" label="Borrower tier" required>
                <select id="calculator-tier" value={fields.borrowerTier} onChange={updateField("borrowerTier")} className={INPUT_CLASS}>
                  <option value="">Select a tier</option>
                  {[0, 1, 2, 3, 4].map((tier) => <option key={tier} value={tier}>Tier {tier}</option>)}
                </select>
              </Field>
              <Field id="calculator-fico" label="Guarantor FICO" required>
                <input id="calculator-fico" value={fields.fico} onChange={updateField("fico")} inputMode="numeric" placeholder="e.g. 736" className={INPUT_CLASS} />
              </Field>
              <Field id="calculator-flips" label="Flips completed with T1F" required>
                <input id="calculator-flips" value={fields.flipsCompletedWithT1f} onChange={updateField("flipsCompletedWithT1f")} inputMode="numeric" placeholder="0" className={INPUT_CLASS} />
              </Field>
              <Field id="calculator-construction-exposure" label="Borrower exposure — construction advances" required>
                <input id="calculator-construction-exposure" value={fields.constructionAdvanceExposure} onChange={updateField("constructionAdvanceExposure")} inputMode="decimal" className={INPUT_CLASS} />
              </Field>
              <Field id="calculator-virtual-exposure" label="Borrower exposure — virtual inspections" required>
                <input id="calculator-virtual-exposure" value={fields.virtualInspectionExposure} onChange={updateField("virtualInspectionExposure")} inputMode="decimal" className={INPUT_CLASS} />
              </Field>
              <Field id="calculator-property-type" label="Property type" required>
                <select id="calculator-property-type" value={fields.propertyType} onChange={updateField("propertyType")} className={INPUT_CLASS}>
                  <option value="sfr">SFR</option>
                  <option value="condo_pud">Condo/PUD</option>
                  <option value="two_to_four">2–4 units</option>
                </select>
              </Field>
            </div>
          </Card>

          <Card className="flex flex-col gap-5">
            <SectionHeading
              number="2"
              title="Loan structure"
              copy="Enter the transaction amounts that drive leverage and loan sizing."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="calculator-purpose" label="Loan purpose" required>
                <select id="calculator-purpose" value={fields.purpose} onChange={updatePurpose} className={INPUT_CLASS}>
                  <option value="purchase_with_rehab">Purchase — With Rehab</option>
                  <option value="purchase_no_rehab">Purchase — No Rehab</option>
                  <option value="refinance_rate_term">Refinance — Rate/Term</option>
                  <option value="refinance_cash_out">Refinance — Cash Out</option>
                </select>
              </Field>
              {purchase ? (
                <Field id="calculator-purchase-price" label="Purchase price" required>
                  <input id="calculator-purchase-price" value={fields.purchasePrice} onChange={updateField("purchasePrice")} inputMode="decimal" placeholder="$0" className={INPUT_CLASS} />
                </Field>
              ) : (
                <Field id="calculator-as-is" label="As-is property value" required>
                  <input id="calculator-as-is" value={fields.asIsValue} onChange={updateField("asIsValue")} inputMode="decimal" placeholder="$0" className={INPUT_CLASS} />
                </Field>
              )}

              {purchase ? (
                <>
                  <Field id="calculator-assignment" label="Assignment fees" hint="Special-program limit: 10% of purchase price.">
                    <input id="calculator-assignment" value={fields.assignmentFees} onChange={updateField("assignmentFees")} inputMode="decimal" className={INPUT_CLASS} />
                  </Field>
                  <Field id="calculator-concessions" label="Seller concessions" hint="Policy guidance: maximum 2% of purchase price.">
                    <input id="calculator-concessions" value={fields.sellerConcessions} onChange={updateField("sellerConcessions")} inputMode="decimal" className={INPUT_CLASS} />
                  </Field>
                  <Field id="calculator-improvements" label="Documented improvements">
                    <input id="calculator-improvements" value={fields.documentedImprovements} onChange={updateField("documentedImprovements")} inputMode="decimal" className={INPUT_CLASS} />
                  </Field>
                  <Field id="calculator-arv" label="After-repair value" required>
                    <input id="calculator-arv" value={fields.arv} onChange={updateField("arv")} inputMode="decimal" placeholder="$0" className={INPUT_CLASS} />
                  </Field>
                </>
              ) : null}

              {withRehab ? (
                <>
                  <Field id="calculator-rehab" label="Rehab budget" required>
                    <input id="calculator-rehab" value={fields.rehabBudget} onChange={updateField("rehabBudget")} inputMode="decimal" placeholder="$0" className={INPUT_CLASS} />
                  </Field>
                  <Field id="calculator-holdback" label="Financed rehab holdback" required hint="Must match the rehab budget for Purchase — With Rehab.">
                    <input id="calculator-holdback" value={fields.rehabHoldback} onChange={updateField("rehabHoldback")} inputMode="decimal" placeholder="$0" className={INPUT_CLASS} />
                  </Field>
                </>
              ) : null}

              {purchase ? (
                <Field id="calculator-requested-ltc" label="Requested LTC" hint="Optional. Enter 85 for 85% if maximum financing is not desired.">
                  <input id="calculator-requested-ltc" value={fields.requestedLtcPercent} onChange={updateField("requestedLtcPercent")} inputMode="decimal" placeholder="Optional %" className={INPUT_CLASS} />
                </Field>
              ) : null}
              <Field id="calculator-requested-points" label="Requested borrower points" hint="Optional. Enter 1 for 1.00% to model a rate buy-up or buy-down.">
                <input id="calculator-requested-points" value={fields.requestedPointsPercent} onChange={updateField("requestedPointsPercent")} inputMode="decimal" placeholder="Optional %" className={INPUT_CLASS} />
              </Field>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4">
              <p className="text-xs text-[var(--text-muted)]">
                Results use the active market snapshot and policy version shown above.
              </p>
              <Button type="submit" data-testid="loan-calculator-submit">
                Calculate loan
              </Button>
            </div>
          </Card>
        </form>

        <div className="xl:sticky xl:top-6" aria-live="polite">
          {result ? (
            <div className="flex flex-col gap-5" data-testid="loan-calculator-results">
              <Card className="overflow-hidden p-0">
                <div className="bg-[var(--brand-deep)] px-5 py-5 text-white">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100/75">Calculated structure</p>
                      <p className="mt-1 text-3xl font-semibold tracking-tight">{formatMoney(result.calculatedTotalLoan)}</p>
                    </div>
                    <Badge className="bg-white/12 text-white">Policy {result.policyVersion}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-emerald-50/75">
                    {fields.city} · {fields.purpose.startsWith("purchase") ? "Purchase" : "Refinance"}
                  </p>
                </div>
                <dl className="grid gap-3 p-5 sm:grid-cols-2">
                  <ResultMetric label="Initial loan" value={formatMoney(result.initialLoanAmount)} emphasis />
                  <ResultMetric label="Rehab holdback" value={formatMoney(result.rehabHoldbackLoanAmount)} />
                  <ResultMetric label="Funded total" value={formatMoney(result.fundedTotalLoanAmount)} />
                  <ResultMetric label="Down payment" value={formatMoney(result.downPaymentRequired)} />
                  <ResultMetric label="Borrower rate" value={formatRate(result.borrowerRatePercent)} emphasis />
                  <ResultMetric label="Adjusted points" value={formatRate(result.adjustedPointsPercent)} />
                  {result.revisedRatePercent !== null ? (
                    <ResultMetric label="Revised rate" value={formatRate(result.revisedRatePercent)} emphasis />
                  ) : null}
                </dl>
              </Card>

              {result.warnings.length > 0 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                  <p className="font-semibold">Review required</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {result.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                  </ul>
                </div>
              ) : null}

              <Card>
                <h3 className="font-semibold text-[var(--text-primary)]">Leverage and sizing</h3>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  <ResultMetric label="Cost basis" value={formatMoney(result.costBasis)} />
                  <ResultMetric label="Maximum LTC" value={formatRatio(result.maxLtc)} />
                  <ResultMetric label="Max initial by LTC" value={formatMoney(result.maxInitialLoanByLtc)} />
                  <ResultMetric label="Maximum ARLTV" value={formatRatio(result.maxArvLtv)} />
                  <ResultMetric label="Max total by ARV" value={formatMoney(result.maxTotalLoanByArv)} />
                  <ResultMetric label="Maximum AIV" value={formatRatio(result.maxAsIsLtv)} />
                  <ResultMetric label="Max loan by AIV" value={formatMoney(result.maxLoanByAsIsValue)} />
                  <ResultMetric label="Actual initial LTC" value={formatRatio(result.actualInitialLtc)} />
                  <ResultMetric label="Actual ARLTV" value={formatRatio(result.actualArvLtv)} />
                  <ResultMetric label="Actual AIV" value={formatRatio(result.actualAsIsLtv)} />
                  <ResultMetric label="Maximum initial draw" value={formatMoney(result.maxInitialConstructionDraw)} />
                  <ResultMetric label="Initial + first advance LTC" value={formatRatio(result.initialPlusFirstAdvanceLtc)} />
                </dl>
              </Card>

              <EligibilityPanel title="Construction advance" result={result.constructionAdvance} />
              <EligibilityPanel title="Virtual inspection" result={result.virtualInspection} />
            </div>
          ) : (
            <Card className="border-dashed py-10 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[var(--brand-muted)] text-xl font-semibold text-[var(--brand)]">%</div>
              <h2 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">Your loan structure will appear here</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--text-muted)]">
                Complete the borrower, market, and loan inputs, then calculate to see sizing, pricing, and eligibility together.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
