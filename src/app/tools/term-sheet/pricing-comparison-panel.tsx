"use client";

import { useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { formatMoneyWholeDollars } from "../loan-structuring-assistant/display-helpers";
import {
  computePricingComparison,
  type LoanStructure,
} from "@/lib/tools/pricing-comparison";

/** Tolerant parse: strips `$`, commas, spaces, `%`. Returns 0 for blank/invalid. */
function parseNum(raw: string): number {
  const cleaned = raw.replace(/[$,%\s]/g, "");
  if (cleaned === "") return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

type SideFields = {
  structure: LoanStructure;
  ratePercent: string;
  originationPointsPercent: string;
  adminFees: string;
};

const T1F_DEFAULT: SideFields = {
  structure: "non_dutch",
  ratePercent: "",
  originationPointsPercent: "",
  adminFees: "",
};

const COMPETITOR_DEFAULT: SideFields = {
  structure: "dutch",
  ratePercent: "",
  originationPointsPercent: "",
  adminFees: "",
};

const inputClass =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";
const labelClass = "flex flex-col gap-1 text-sm";
const labelSpanClass = "font-medium text-zinc-800 dark:text-zinc-200";

/**
 * Pricing Comparison — illustrative, non-binding calculator comparing a T1F loan against a
 * competitor's pricing/terms. All inputs are entered manually; see
 * `@/lib/tools/pricing-comparison` for the math.
 */
export function PricingComparisonPanel() {
  const [initialLoanAmount, setInitialLoanAmount] = useState("");
  const [holdbackAmount, setHoldbackAmount] = useState("");
  const [avgHoldbackDisbursedPct, setAvgHoldbackDisbursedPct] = useState("50");
  const [loanDurationMonths, setLoanDurationMonths] = useState("");
  const [t1f, setT1f] = useState<SideFields>(T1F_DEFAULT);
  const [competitor, setCompetitor] = useState<SideFields>(COMPETITOR_DEFAULT);

  const result = useMemo(
    () =>
      computePricingComparison({
        initialLoanAmount: parseNum(initialLoanAmount),
        holdbackAmount: parseNum(holdbackAmount),
        avgHoldbackDisbursedFraction: parseNum(avgHoldbackDisbursedPct) / 100,
        loanDurationMonths: parseNum(loanDurationMonths),
        t1f: {
          structure: t1f.structure,
          ratePercent: parseNum(t1f.ratePercent),
          originationPointsPercent: parseNum(t1f.originationPointsPercent),
          adminFees: parseNum(t1f.adminFees),
        },
        competitor: {
          structure: competitor.structure,
          ratePercent: parseNum(competitor.ratePercent),
          originationPointsPercent: parseNum(competitor.originationPointsPercent),
          adminFees: parseNum(competitor.adminFees),
        },
      }),
    [
      initialLoanAmount,
      holdbackAmount,
      avgHoldbackDisbursedPct,
      loanDurationMonths,
      t1f,
      competitor,
    ],
  );

  const setSide =
    (
      setter: React.Dispatch<React.SetStateAction<SideFields>>,
      key: keyof Omit<SideFields, "structure">,
    ) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setter((s) => ({ ...s, [key]: value }));
    };

  const setStructure =
    (setter: React.Dispatch<React.SetStateAction<SideFields>>) =>
    (e: ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value as LoanStructure;
      setter((s) => ({ ...s, structure: value }));
    };

  return (
    <section
      data-testid="pricing-comparison"
      className="flex flex-col gap-6 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
    >
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Pricing Comparison
        </h2>
        <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Enter the competitor&apos;s pricing and terms alongside T1F&apos;s to estimate the
          borrower&apos;s savings. Illustrative and non-binding — interest is a simple estimate,
          not an amortization schedule.
        </p>
      </header>

      {/* Loan Information */}
      <fieldset className="flex flex-col gap-4">
        <legend className="text-sm font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-300">
          Loan Information
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            <span className={labelSpanClass}>Initial loan amount</span>
            <input
              data-testid="pc-initial-loan"
              value={initialLoanAmount}
              onChange={(e) => setInitialLoanAmount(e.target.value)}
              inputMode="decimal"
              placeholder="e.g. 250000"
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            <span className={labelSpanClass}>Holdback amount</span>
            <input
              data-testid="pc-holdback"
              value={holdbackAmount}
              onChange={(e) => setHoldbackAmount(e.target.value)}
              inputMode="decimal"
              placeholder="e.g. 50000"
              className={inputClass}
            />
          </label>
          <div className={labelClass}>
            <span className={labelSpanClass}>Total loan amount</span>
            <output
              data-testid="pc-total-loan"
              className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-medium tabular-nums text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
            >
              {formatMoneyWholeDollars(result.totalLoanAmount)}
            </output>
          </div>
          <label className={labelClass}>
            <span className={labelSpanClass}>Avg % holdback disbursed in term</span>
            <input
              data-testid="pc-avg-holdback"
              value={avgHoldbackDisbursedPct}
              onChange={(e) => setAvgHoldbackDisbursedPct(e.target.value)}
              inputMode="decimal"
              placeholder="e.g. 50"
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            <span className={labelSpanClass}>Loan duration (months)</span>
            <input
              data-testid="pc-duration"
              value={loanDurationMonths}
              onChange={(e) => setLoanDurationMonths(e.target.value)}
              inputMode="numeric"
              placeholder="e.g. 8"
              className={inputClass}
            />
          </label>
        </div>
      </fieldset>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* T1F Loan Economics */}
        <fieldset className="flex flex-col gap-4 rounded-lg border border-emerald-200 p-4 dark:border-emerald-900/50">
          <legend className="px-1 text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            T1F Loan Economics
          </legend>
          <label className={labelClass}>
            <span className={labelSpanClass}>Loan structure</span>
            <select
              data-testid="pc-t1f-structure"
              value={t1f.structure}
              onChange={setStructure(setT1f)}
              className={inputClass}
            >
              <option value="non_dutch">Non-Dutch (Draw)</option>
              <option value="dutch">Dutch (Term)</option>
            </select>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              &quot;Term&quot; loan (dutch) charges on the full balance; &quot;Draw&quot;
              (non-dutch) charges only on funds drawn.
            </span>
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className={labelClass}>
              <span className={labelSpanClass}>Rate (%)</span>
              <input
                data-testid="pc-t1f-rate"
                value={t1f.ratePercent}
                onChange={setSide(setT1f, "ratePercent")}
                inputMode="decimal"
                placeholder="e.g. 8.5"
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              <span className={labelSpanClass}>Origination points (%)</span>
              <input
                data-testid="pc-t1f-points"
                value={t1f.originationPointsPercent}
                onChange={setSide(setT1f, "originationPointsPercent")}
                inputMode="decimal"
                placeholder="e.g. 0.5"
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              <span className={labelSpanClass}>Admin fees ($)</span>
              <input
                data-testid="pc-t1f-admin"
                value={t1f.adminFees}
                onChange={setSide(setT1f, "adminFees")}
                inputMode="decimal"
                placeholder="e.g. 1195"
                className={inputClass}
              />
            </label>
          </div>
          <dl className="mt-1 space-y-0 text-sm">
            <ResultRow label="Interest" value={formatMoneyWholeDollars(result.t1f.interest)} />
            <ResultRow
              label="Origination points"
              value={formatMoneyWholeDollars(result.t1f.originationPointsDollars)}
            />
            <ResultRow label="Admin fees" value={formatMoneyWholeDollars(result.t1f.adminFees)} />
            <ResultRow
              label="Total interest, points & fees"
              value={formatMoneyWholeDollars(result.t1f.totalInterestPointsFees)}
              emphasis
            />
            <ResultRow
              label="T1F revenue"
              value={formatMoneyWholeDollars(result.t1f.revenue)}
              highlight
              testId="pc-t1f-revenue"
            />
            <ResultRow
              label="Adjusted total interest, points & fees"
              value={formatMoneyWholeDollars(result.t1f.adjustedTotalInterestPointsFees)}
            />
          </dl>
        </fieldset>

        {/* Competitor Loan Economics */}
        <fieldset className="flex flex-col gap-4 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
          <legend className="px-1 text-sm font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-300">
            Competitor Loan Economics
          </legend>
          <label className={labelClass}>
            <span className={labelSpanClass}>Loan structure</span>
            <select
              data-testid="pc-comp-structure"
              value={competitor.structure}
              onChange={setStructure(setCompetitor)}
              className={inputClass}
            >
              <option value="non_dutch">Non-Dutch (Draw)</option>
              <option value="dutch">Dutch (Term)</option>
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className={labelClass}>
              <span className={labelSpanClass}>Rate (%)</span>
              <input
                data-testid="pc-comp-rate"
                value={competitor.ratePercent}
                onChange={setSide(setCompetitor, "ratePercent")}
                inputMode="decimal"
                placeholder="e.g. 8.5"
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              <span className={labelSpanClass}>Origination points (%)</span>
              <input
                data-testid="pc-comp-points"
                value={competitor.originationPointsPercent}
                onChange={setSide(setCompetitor, "originationPointsPercent")}
                inputMode="decimal"
                placeholder="e.g. 0.5"
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              <span className={labelSpanClass}>Admin fees ($)</span>
              <input
                data-testid="pc-comp-admin"
                value={competitor.adminFees}
                onChange={setSide(setCompetitor, "adminFees")}
                inputMode="decimal"
                placeholder="e.g. 1195"
                className={inputClass}
              />
            </label>
          </div>
          <dl className="mt-1 space-y-0 text-sm">
            <ResultRow
              label="Interest"
              value={formatMoneyWholeDollars(result.competitor.interest)}
            />
            <ResultRow
              label="Origination points"
              value={formatMoneyWholeDollars(result.competitor.originationPointsDollars)}
            />
            <ResultRow
              label="Admin fees"
              value={formatMoneyWholeDollars(result.competitor.adminFees)}
            />
            <ResultRow
              label="Total interest, points & fees"
              value={formatMoneyWholeDollars(result.competitor.totalInterestPointsFees)}
              emphasis
            />
          </dl>
        </fieldset>
      </div>

      {/* Comparison */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border-2 border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
            Pricing Gap
          </p>
          <p
            data-testid="pc-pricing-gap"
            className="mt-1 text-2xl font-semibold tabular-nums text-emerald-900 dark:text-emerald-100"
          >
            {formatMoneyWholeDollars(result.pricingGap)}
          </p>
          <p className="mt-1 text-xs text-emerald-800/80 dark:text-emerald-300/80">
            Total interest, points &amp; fees saved with T1F vs the competitor.
          </p>
        </div>
        <div className="rounded-lg border-2 border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
            Upfront Savings
          </p>
          <p
            data-testid="pc-upfront-savings"
            className="mt-1 text-2xl font-semibold tabular-nums text-emerald-900 dark:text-emerald-100"
          >
            {formatMoneyWholeDollars(result.upfrontSavings)}
          </p>
          <p className="mt-1 text-xs text-emerald-800/80 dark:text-emerald-300/80">
            Difference in upfront points &amp; fees (competitor minus T1F).
          </p>
        </div>
      </div>
    </section>
  );
}

function ResultRow({
  label,
  value,
  emphasis,
  highlight,
  testId,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  highlight?: boolean;
  testId?: string;
}) {
  return (
    <div
      className={`flex justify-between gap-4 border-b border-zinc-100 py-2 last:border-b-0 dark:border-zinc-800/80 ${
        highlight ? "rounded bg-yellow-100 px-2 dark:bg-yellow-500/20" : ""
      }`}
    >
      <dt className={`text-zinc-600 dark:text-zinc-400 ${emphasis ? "font-semibold text-zinc-900 dark:text-zinc-100" : ""}`}>
        {label}
      </dt>
      <dd
        data-testid={testId}
        className={`text-right tabular-nums text-zinc-900 dark:text-zinc-100 ${
          emphasis || highlight ? "font-semibold" : "font-medium"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
