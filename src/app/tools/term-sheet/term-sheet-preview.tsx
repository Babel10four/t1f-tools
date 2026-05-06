import type { DealAnalyzeRequestV1 } from "@/lib/engines/deal/schemas/canonical-request";
import type { DealAnalyzeResponseV1 } from "@/lib/engines/deal/schemas/canonical-response";
import { DisclosureBanner } from "@/components/tools/disclosure-banner";
import {
  TERM_SHEET_DISCLAIMER_DETAILS,
  TERM_SHEET_DISCLAIMER_SUMMARY,
} from "@/lib/tools/disclaimer-copy";
import {
  formatMoneyWholeDollars,
  groupRisksBySeverity,
  sortAnalysisFlagsForDisplay,
} from "../loan-structuring-assistant/display-helpers";
import {
  formatNoteRatePercentDisplay,
  formatPricingScalar,
} from "../pricing-calculator/pricing-display";
import { transformCashToCloseDisplayLines } from "../cash-to-close-estimator/cash-to-close-estimator-display";
import { TermSheetExportBar } from "./term-sheet-export-bar";
import { buildTermSheetCtcInputRows, TERM_SHEET_CTC_THIRD_PARTY_ASSUMPTIONS } from "./term-sheet-cash-to-close-fields";
import type { TermSheetLocalMetadata } from "./term-sheet-types";
import { T1fTermSheetLogo } from "@/components/branding/t1f-term-sheet-logo";

export type { TermSheetLocalMetadata } from "./term-sheet-types";

function displayMeta(s: string): string {
  return s.trim() === "" ? "—" : s;
}

function purposeLabel(p: string): string {
  switch (p) {
    case "purchase":
      return "Purchase";
    case "refinance":
      return "Refinance";
    default:
      return p;
  }
}

function originationFromPointsDollars(
  totalLoan: number | undefined,
  pct: number | undefined,
): number | undefined {
  if (totalLoan === undefined || pct === undefined) {
    return undefined;
  }
  return Math.round(totalLoan * (pct / 100) * 100) / 100;
}

function formatPreparedDate(ymd: string): string {
  const t = ymd.trim();
  if (t === "") {
    return "—";
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) {
    return t;
  }
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function TermSheetPreview({
  metadata,
  request,
  response,
}: {
  metadata: TermSheetLocalMetadata;
  response: DealAnalyzeResponseV1;
  request?: DealAnalyzeRequestV1;
}) {
  const sortedFlags = sortAnalysisFlagsForDisplay(response.analysis.flags);
  const riskGroups = groupRisksBySeverity(response.risks);
  const pricing = response.pricing;
  const cash = response.cashToClose;
  const loan = response.loan;

  const totalPctArv =
    loan.amount !== undefined &&
    request?.property?.arv !== undefined &&
    request.property.arv > 0
      ? Math.round((loan.amount / request.property.arv) * 1000) / 10
      : undefined;

  const cashPurpose = loan.purpose === "refinance" ? "refinance" : "purchase";
  const cashDisplayLines = transformCashToCloseDisplayLines(cash.items, {
    purpose: cashPurpose,
    purchasePrice: request?.deal.purchasePrice,
  });
  const cashModelInputRows = buildTermSheetCtcInputRows(request, response);

  return (
    <article
      className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      data-testid="ts-preview"
    >
      <section
        aria-label="Disclaimer"
        className="border-b border-zinc-200 pb-4 dark:border-zinc-800"
        data-testid="ts-disclaimer"
      >
        <DisclosureBanner
          summary={TERM_SHEET_DISCLAIMER_SUMMARY}
          detailLabel="Privacy / Disclaimer"
          details={TERM_SHEET_DISCLAIMER_DETAILS.map((line) => (
            <p key={line}>{line}</p>
          ))}
        />
      </section>

      <TermSheetExportBar
        metadata={metadata}
        request={request}
        response={response}
      />

      <header className="border-b border-zinc-200 py-6 text-center dark:border-zinc-800">
        <T1fTermSheetLogo className="mx-auto mb-2" />
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Tier One Funding Inc
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Term Sheet
        </h2>
        <p className="mt-3 text-base font-medium text-zinc-900 dark:text-zinc-100">
          {displayMeta(metadata.propertyLabel)}
        </p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Prepared: {formatPreparedDate(metadata.preparedDate)}
          {metadata.preparedBy.trim() !== "" ? (
            <>
              {" "}
              · Prepared by: {metadata.preparedBy}
            </>
          ) : null}
        </p>
        {metadata.internalDealLabel.trim() !== "" ||
        metadata.counterpartyLabel.trim() !== "" ? (
          <dl className="mx-auto mt-4 max-w-lg text-left text-sm">
            {metadata.internalDealLabel.trim() !== "" ? (
              <div className="flex justify-between gap-4 py-1">
                <dt className="text-zinc-500">Internal deal</dt>
                <dd>{metadata.internalDealLabel}</dd>
              </div>
            ) : null}
            {metadata.counterpartyLabel.trim() !== "" ? (
              <div className="flex justify-between gap-4 py-1">
                <dt className="text-zinc-500">Counterparty</dt>
                <dd>{metadata.counterpartyLabel}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </header>

      <section className="border-b border-zinc-200 py-5 dark:border-zinc-800">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-900 dark:text-zinc-50">
          Inputs
        </h3>
        <dl className="mt-4 space-y-0 text-[15px] leading-relaxed">
          <div className="flex justify-between gap-4 border-b border-zinc-100 py-3 dark:border-zinc-800/80">
            <dt className="text-zinc-500">Transaction type</dt>
            <dd className="text-right font-medium text-zinc-900 dark:text-zinc-100">
              {purposeLabel(loan.purpose)}
            </dd>
          </div>
          {request?.deal.purchasePrice !== undefined ? (
            <div className="flex justify-between gap-4 border-b border-zinc-100 py-3 dark:border-zinc-800/80">
              <dt className="text-zinc-500">Purchase price</dt>
              <dd className="text-right tabular-nums">
                {formatMoneyWholeDollars(request.deal.purchasePrice)}
              </dd>
            </div>
          ) : null}
          {request?.deal.payoffAmount !== undefined ? (
            <div className="flex justify-between gap-4 border-b border-zinc-100 py-3 dark:border-zinc-800/80">
              <dt className="text-zinc-500">Payoff amount</dt>
              <dd className="text-right tabular-nums">
                {formatMoneyWholeDollars(request.deal.payoffAmount)}
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4 border-b border-zinc-100 py-3 dark:border-zinc-800/80">
            <dt className="text-zinc-500">Rehab amount</dt>
            <dd className="text-right tabular-nums">
              {formatMoneyWholeDollars(request?.deal.rehabBudget ?? loan.rehabBudget)}
            </dd>
          </div>
          {request?.property?.arv !== undefined ? (
            <div className="flex justify-between gap-4 border-b border-zinc-100 py-3 dark:border-zinc-800/80">
              <dt className="text-zinc-500">ARV</dt>
              <dd className="text-right tabular-nums">
                {formatMoneyWholeDollars(request.property.arv)}
              </dd>
            </div>
          ) : null}
          {loan.originationPointsPercent !== undefined ? (
            <div className="flex justify-between gap-4 border-b border-zinc-100 py-3 dark:border-zinc-800/80">
              <dt className="text-zinc-500">Lender points</dt>
              <dd className="text-right tabular-nums">
                {formatNoteRatePercentDisplay(loan.originationPointsPercent)}
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4 border-b border-zinc-100 py-3 dark:border-zinc-800/80">
            <dt className="text-zinc-500">Rate</dt>
            <dd className="text-right">
              {formatPricingScalar("noteRatePercent", pricing)}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-zinc-100 py-3 dark:border-zinc-800/80">
            <dt className="text-zinc-500">Term</dt>
            <dd className="text-right">
              {loan.termMonths === null || loan.termMonths === undefined
                ? "—"
                : `${loan.termMonths} months`}
            </dd>
          </div>
          {loan.originationFlatFee !== undefined ? (
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-zinc-500">Lender loan fee</dt>
              <dd className="text-right tabular-nums">
                {formatMoneyWholeDollars(loan.originationFlatFee)}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="border-b border-zinc-200 py-5 dark:border-zinc-800">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-900 dark:text-zinc-50">
          Terms offered
        </h3>
        <dl className="mt-4 space-y-0 text-[15px] leading-relaxed">
          {loan.acquisitionLoanAmount !== undefined ? (
            <div className="flex justify-between gap-4 border-b border-zinc-100 py-3 dark:border-zinc-800/80">
              <dt className="text-zinc-500">Acquisition funds</dt>
              <dd className="text-right tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
                {formatMoneyWholeDollars(loan.acquisitionLoanAmount)}
              </dd>
            </div>
          ) : null}
          {loan.rehabLoanAmount !== undefined ? (
            <div className="flex justify-between gap-4 border-b border-zinc-100 py-3 dark:border-zinc-800/80">
              <dt className="text-zinc-500">Rehab loan</dt>
              <dd className="text-right tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
                {formatMoneyWholeDollars(loan.rehabLoanAmount)}
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4 border-b border-zinc-100 py-3 dark:border-zinc-800/80">
            <dt className="text-zinc-500">
              Total loan
              {totalPctArv !== undefined ? (
                <span className="font-normal text-zinc-400">
                  {" "}
                  ({totalPctArv}% of ARV)
                </span>
              ) : null}
            </dt>
            <dd className="text-right tabular-nums font-semibold text-zinc-900 dark:text-zinc-100">
              {formatMoneyWholeDollars(loan.amount)}
            </dd>
          </div>
          {loan.originationPointsPercent !== undefined &&
          originationFromPointsDollars(loan.amount, loan.originationPointsPercent) !==
            undefined ? (
            <div className="flex justify-between gap-4 border-b border-zinc-100 py-3 dark:border-zinc-800/80">
              <dt className="text-zinc-500">
                Est. origination (points on total loan)
                <span className="mt-0.5 block font-normal text-zinc-400">
                  {formatNoteRatePercentDisplay(loan.originationPointsPercent)} of{" "}
                  {formatMoneyWholeDollars(loan.amount)}
                </span>
              </dt>
              <dd className="text-right tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
                {formatMoneyWholeDollars(
                  originationFromPointsDollars(
                    loan.amount,
                    loan.originationPointsPercent,
                  )!,
                )}
              </dd>
            </div>
          ) : null}
          {loan.originationFlatFee !== undefined ? (
            <div className="flex justify-between gap-4 border-b border-zinc-100 py-3 dark:border-zinc-800/80">
              <dt className="text-zinc-500">Lender loan fee (charged)</dt>
              <dd className="text-right tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
                {formatMoneyWholeDollars(loan.originationFlatFee)}
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4 border-b border-zinc-100 py-3 dark:border-zinc-800/80">
            <dt className="text-zinc-500">LTV</dt>
            <dd className="text-right tabular-nums">
              {loan.ltv !== undefined ? `${loan.ltv}%` : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-zinc-500">LTC</dt>
            <dd className="text-right tabular-nums">
              {loan.ltcPercent !== undefined ? `${loan.ltcPercent}%` : "—"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="border-b border-zinc-200 py-4 dark:border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Pricing (engine)
        </h3>
        <p className="mt-1 text-sm">
          Status:{" "}
          <strong data-testid="ts-pricing-status">{pricing.status}</strong>
        </p>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div data-testid="ts-pricing-note-rate-row">
            <dt className="text-xs text-zinc-500">Note rate (%)</dt>
            <dd data-testid="ts-pricing-note-rate">
              {formatPricingScalar("noteRatePercent", pricing)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Margin (bps)</dt>
            <dd>{formatPricingScalar("marginBps", pricing)}</dd>
          </div>
        </dl>
      </section>

      <section className="border-b border-zinc-200 py-4 dark:border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Analysis
        </h3>
        <p className="mt-1 text-sm">
          Status:{" "}
          <span className="font-mono text-xs">{response.analysis.status}</span>
        </p>
        {sortedFlags.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            No flags returned.
          </p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {sortedFlags.map((f) => (
              <li key={`${f.code}-${f.message}`}>
                <span className="font-mono text-xs text-zinc-500">{f.code}</span>
                <p className="text-zinc-900 dark:text-zinc-100">{f.message}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="pt-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Risks / next steps
        </h3>
        {response.risks.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            None returned.
          </p>
        ) : (
          <div className="mt-3 space-y-6">
            {riskGroups.map((g) => (
              <div key={g.severity}>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {g.severity}
                </p>
                <ul className="mt-2 space-y-3">
                  {g.risks.map((r) => (
                    <li key={`${r.code}-${r.title}`}>
                      <p className="font-medium">{r.title}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                        {r.detail}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section
        className="mt-8 border-t-2 border-zinc-300 py-6 dark:border-zinc-600 print:break-before-page"
        aria-label="Cash to close"
      >
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-900 dark:text-zinc-50">
          Cash to close
        </h3>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Indicative estimate only — not a Closing Disclosure. Assumed title,
          escrow settlement, hazard insurance, and similar third-party fees are
          placeholders.
        </p>

        <h4 className="mt-6 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Inputs
        </h4>
        <dl className="mt-3 space-y-0 text-[15px] leading-relaxed">
          {cashModelInputRows.map((row, i) => (
            <div
              key={`${row.label}-${i}`}
              className="flex justify-between gap-4 border-b border-zinc-100 py-2.5 last:border-b-0 dark:border-zinc-800/80"
            >
              <dt className="max-w-[58%] text-zinc-500">{row.label}</dt>
              <dd className="text-right text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>

        <h4 className="mt-8 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Estimate
        </h4>
        <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
          {TERM_SHEET_CTC_THIRD_PARTY_ASSUMPTIONS}
        </p>
        {cashDisplayLines.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            No line-by-line cash to close breakdown is shown — regenerate after
            filling in the deal inputs above, if applicable.
          </p>
        ) : (
          <dl className="mt-3 space-y-4 text-[15px] leading-relaxed" data-testid="ts-cash-items">
            {cashDisplayLines.map((line, i) => {
              const isTotal = line.label === "Total estimated cash to close";
              return (
                <div
                  key={`${line.label}-${i}`}
                  className={`border-b border-zinc-100 pb-3 dark:border-zinc-800/80 ${isTotal ? "border-b-0 pb-0" : ""}`}
                >
                  <div className="flex justify-between gap-4">
                    <dt className={`text-zinc-700 dark:text-zinc-200 ${isTotal ? "font-semibold text-zinc-900 dark:text-zinc-50" : ""}`}>
                      {line.label}
                    </dt>
                    <dd
                      className={`tabular-nums ${isTotal ? "font-semibold text-zinc-900 dark:text-zinc-50" : "font-medium text-zinc-900 dark:text-zinc-100"}`}
                    >
                      {formatMoneyWholeDollars(line.amount)}
                    </dd>
                  </div>
                  {line.sublabel ? (
                    <p className="mt-1 text-xs italic text-zinc-500">{line.sublabel}</p>
                  ) : null}
                  {line.footnote ? (
                    <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                      {line.footnote}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </dl>
        )}
        <div className="mt-6 border-t border-dashed border-zinc-300 pt-4 dark:border-zinc-600">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
            Estimated cash to close (total)
          </p>
          <p className="mt-2 text-sm" data-testid="ts-cash-total">
            {cash.estimatedTotal === null ? (
              <span>Not available for this scenario.</span>
            ) : (
              <span>
                <strong>{formatMoneyWholeDollars(cash.estimatedTotal)}</strong>
              </span>
            )}
          </p>
        </div>
      </section>

      <footer className="mt-6 border-t border-zinc-200 pt-4 text-center text-xs text-zinc-500 dark:border-zinc-800">
        <p>
          All terms are subject to underwriting, appraisal/valuation, and final approval.
          Rates, fees, and proceeds shown are estimates and may change.
        </p>
        <p className="mt-2 font-mono text-[10px] text-zinc-400">v1</p>
      </footer>
    </article>
  );
}
