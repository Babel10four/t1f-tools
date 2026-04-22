import type { DealAnalyzeRequestV1 } from "@/lib/engines/deal/schemas/canonical-request";
import type { DealAnalyzeResponseV1 } from "@/lib/engines/deal/schemas/canonical-response";
import {
  formatMoney,
  groupRisksBySeverity,
  sortAnalysisFlagsForDisplay,
} from "../loan-structuring-assistant/display-helpers";
import { formatPricingScalar } from "../pricing-calculator/pricing-display";
import { TermSheetExportBar } from "./term-sheet-export-bar";
import type { TermSheetLocalMetadata } from "./term-sheet-types";

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
  const tier = request?.borrower?.experienceTier;

  const totalPctArv =
    loan.amount !== undefined &&
    request?.property?.arv !== undefined &&
    request.property.arv > 0
      ? Math.round((loan.amount / request.property.arv) * 1000) / 10
      : undefined;

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
        <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          <strong className="font-semibold text-zinc-900 dark:text-zinc-100">
            Indicative, non-binding preview only.
          </strong>{" "}
          This term sheet is for discussion purposes only and does not constitute a
          commitment to lend. This is an internal workflow preview from API outputs; it
          is not a rate lock, borrower-facing disclosure, or underwriting decision.
        </p>
      </section>

      <TermSheetExportBar
        metadata={metadata}
        request={request}
        response={response}
      />

      <header className="border-b border-zinc-200 py-6 text-center dark:border-zinc-800">
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

      <section className="border-b border-zinc-200 py-4 dark:border-zinc-800">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-900 dark:text-zinc-50">
          Inputs
        </h3>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-4 border-b border-zinc-100 py-2 dark:border-zinc-800/80">
            <dt className="text-zinc-500">Transaction type</dt>
            <dd className="text-right font-medium text-zinc-900 dark:text-zinc-100">
              {purposeLabel(loan.purpose)}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-zinc-100 py-2 dark:border-zinc-800/80">
            <dt className="text-zinc-500">Tier</dt>
            <dd className="text-right">
              {tier !== undefined && tier !== "" ? tier : "—"}
            </dd>
          </div>
          {request?.deal.purchasePrice !== undefined ? (
            <div className="flex justify-between gap-4 border-b border-zinc-100 py-2 dark:border-zinc-800/80">
              <dt className="text-zinc-500">Purchase price</dt>
              <dd className="text-right tabular-nums">
                {formatMoney(request.deal.purchasePrice)}
              </dd>
            </div>
          ) : null}
          {request?.deal.payoffAmount !== undefined ? (
            <div className="flex justify-between gap-4 border-b border-zinc-100 py-2 dark:border-zinc-800/80">
              <dt className="text-zinc-500">Payoff amount</dt>
              <dd className="text-right tabular-nums">
                {formatMoney(request.deal.payoffAmount)}
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4 border-b border-zinc-100 py-2 dark:border-zinc-800/80">
            <dt className="text-zinc-500">Rehab amount</dt>
            <dd className="text-right tabular-nums">
              {formatMoney(request?.deal.rehabBudget ?? loan.rehabBudget)}
            </dd>
          </div>
          {request?.property?.arv !== undefined ? (
            <div className="flex justify-between gap-4 border-b border-zinc-100 py-2 dark:border-zinc-800/80">
              <dt className="text-zinc-500">ARV</dt>
              <dd className="text-right tabular-nums">
                {formatMoney(request.property.arv)}
              </dd>
            </div>
          ) : null}
          {loan.originationPointsPercent !== undefined ? (
            <div className="flex justify-between gap-4 border-b border-zinc-100 py-2 dark:border-zinc-800/80">
              <dt className="text-zinc-500">Points</dt>
              <dd className="text-right tabular-nums">
                {loan.originationPointsPercent}%
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4 border-b border-zinc-100 py-2 dark:border-zinc-800/80">
            <dt className="text-zinc-500">Rate</dt>
            <dd className="text-right">
              {formatPricingScalar("noteRatePercent", pricing)}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-zinc-100 py-2 dark:border-zinc-800/80">
            <dt className="text-zinc-500">Term</dt>
            <dd className="text-right">
              {loan.termMonths === null || loan.termMonths === undefined
                ? "—"
                : `${loan.termMonths} months`}
            </dd>
          </div>
          {loan.originationFlatFee !== undefined ? (
            <div className="flex justify-between gap-4 py-2">
              <dt className="text-zinc-500">Loan fee</dt>
              <dd className="text-right tabular-nums">
                {formatMoney(loan.originationFlatFee)}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="border-b border-zinc-200 py-4 dark:border-zinc-800">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-900 dark:text-zinc-50">
          Terms offered
        </h3>
        <dl className="mt-3 space-y-2 text-sm">
          {loan.acquisitionLoanAmount !== undefined ? (
            <div className="flex justify-between gap-4 border-b border-zinc-100 py-2 dark:border-zinc-800/80">
              <dt className="text-zinc-500">Initial / acquisition loan</dt>
              <dd className="text-right tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
                {formatMoney(loan.acquisitionLoanAmount)}
              </dd>
            </div>
          ) : null}
          {loan.rehabLoanAmount !== undefined ? (
            <div className="flex justify-between gap-4 border-b border-zinc-100 py-2 dark:border-zinc-800/80">
              <dt className="text-zinc-500">Rehab loan</dt>
              <dd className="text-right tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
                {formatMoney(loan.rehabLoanAmount)}
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4 border-b border-zinc-100 py-2 dark:border-zinc-800/80">
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
              {formatMoney(loan.amount)}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-zinc-100 py-2 dark:border-zinc-800/80">
            <dt className="text-zinc-500">LTV</dt>
            <dd className="text-right tabular-nums">
              {loan.ltv !== undefined ? `${loan.ltv}%` : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-4 py-2">
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
          Cash to close
        </h3>
        <p className="mt-1 text-sm">
          Status: <strong>{cash.status}</strong>
        </p>
        <p className="mt-2 text-sm" data-testid="ts-cash-total">
          {cash.estimatedTotal === null ? (
            <span>Estimated total: not returned (line items are not summed here).</span>
          ) : (
            <span>Estimated total: {formatMoney(cash.estimatedTotal)}</span>
          )}
        </p>
        {cash.items.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            No line items returned.
          </p>
        ) : (
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm" data-testid="ts-cash-items">
            {cash.items.map((item, i) => (
              <li key={`${item.label}-${i}`} className="flex justify-between gap-4">
                <span>{item.label}</span>
                <span className="tabular-nums">{formatMoney(item.amount)}</span>
              </li>
            ))}
          </ol>
        )}
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
