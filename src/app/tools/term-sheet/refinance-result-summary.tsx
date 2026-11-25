import type { DealAnalyzeResponseV1 } from "@/lib/engines/deal/schemas/canonical-response";
import { buildCashToCloseLoanCostSummary } from "../cash-to-close-estimator/cash-to-close-estimator-display";
import { formatMoneyWholeDollars } from "../loan-structuring-assistant/display-helpers";
import type { MouseEvent } from "react";

function editSection(event: MouseEvent<HTMLAnchorElement>) {
  const section = document.getElementById(event.currentTarget.hash.slice(1));
  if (!section) return;
  event.preventDefault();
  if (section instanceof HTMLDetailsElement) section.open = true;
  section.focus({ preventScroll: true });
  section.scrollIntoView?.({ block: "start" });
}

type RefinanceResultSummaryProps = {
  response: DealAnalyzeResponseV1;
  asOfDate?: Date;
};

export function RefinanceResultSummary({ response, asOfDate }: RefinanceResultSummaryProps) {
  const { loan, risks } = response;
  const cash = buildCashToCloseLoanCostSummary({ flow: "refinance", response, asOfDate });
  const payoff = loan.payoffAmount;
  const initial = loan.acquisitionLoanAmount;
  const surplus = payoff !== undefined && initial !== undefined && initial > payoff
    ? initial - payoff
    : undefined;
  const estimate = cash.estimatedLoanCostsExcludingTitleInsurance;
  const hasCashLines = response.cashToClose.items.length > 0;
  const capped = risks.some((risk) => risk.code === "REQUEST_EXCEEDS_POLICY_MAX");
  const sizingIssues = loan.amount === undefined ? risks.filter((risk) => risk.severity === "high") : [];
  const basis = loan.bindingLeg === "arv_ltv_refi" ? "after-repair value" :
    loan.bindingLeg === "aiv_ltv_refi" ? "as-is value" : undefined;
  const rows = [
    ["Requested total loan", loan.requestedLoanAmount === undefined ? "No amount specified" : formatMoneyWholeDollars(loan.requestedLoanAmount)],
    ["Indicative total loan", formatMoneyWholeDollars(loan.amount)],
    ["Initial funds at closing", formatMoneyWholeDollars(initial)],
    ["Reserved for rehab draws", formatMoneyWholeDollars(loan.rehabLoanAmount)],
  ];

  return (
    <section aria-label="Refinance funding summary" className="my-5 overflow-hidden rounded-xl border border-[var(--border-subtle)] text-[var(--text-primary)] print:hidden">
      <div className="bg-[var(--surface-soft)] px-5 py-4">
        <h3 className="text-sm font-semibold">{surplus !== undefined ? "Estimated closing costs before applying excess proceeds" : "Estimated cash to close"}</h3>
        <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
          {estimate === null ? "Estimate unavailable" : formatMoneyWholeDollars(estimate)}
        </p>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          {estimate !== null ? (
            <>Payoff shortfall {formatMoneyWholeDollars(cash.basisAmount)} + loan fees {formatMoneyWholeDollars(cash.loanFees)} + interest {formatMoneyWholeDollars(cash.interestCosts)}. Excludes title and insurance.</>
          ) : loan.amount === undefined ? (
            "Review the sizing details below before quoting this refinance."
          ) : payoff === undefined ? (
            "Enter the existing payoff amount and update the preview."
          ) : response.pricing.noteRatePercent == null ? (
            "Enter a note rate and update the preview to include interest costs."
          ) : (
            "A complete interest and closing-cost estimate is unavailable for this allocation."
          )}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-5 py-4 text-sm lg:grid-cols-4">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[var(--text-muted)]">{label}</dt>
            <dd className="mt-1 font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {surplus !== undefined ? (
        <p className="px-5 pb-4 text-sm">Initial funds exceed the existing payoff by <strong>{formatMoneyWholeDollars(surplus)}</strong> before fees and interest.</p>
      ) : hasCashLines && estimate === null ? (
        <p className="px-5 pb-4 text-sm">The payoff shortfall is <strong>{formatMoneyWholeDollars(cash.basisAmount)}</strong> before fees and interest.</p>
      ) : null}
      {capped && loan.amount !== undefined ? (
        <p className="border-t border-[var(--border-subtle)] px-5 py-3 text-sm">
          The {basis ? `${basis} limit` : "policy limit"} caps the total loan at {formatMoneyWholeDollars(loan.amount)}.
          {(loan.rehabLoanAmount ?? 0) > 0 ? " The full rehab amount is reserved, reducing the funds available at closing." : ""}
        </p>
      ) : null}
      {sizingIssues.length > 0 ? (
        <ul aria-label="Sizing details" className="border-t border-[var(--border-subtle)] px-5 py-3 text-sm">
          {sizingIssues.map((risk) => (
            <li key={risk.code}>{risk.title}</li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-[var(--border-subtle)] px-5 py-3 text-sm font-medium text-[var(--brand)]">
        <a href="#refi-funding" onClick={editSection} className="underline underline-offset-4">Edit funding request</a>
        <a href="#refi-property" onClick={editSection} className="underline underline-offset-4">Edit property values</a>
        <a href="#refi-pricing" onClick={editSection} className="underline underline-offset-4">Edit pricing and fees</a>
      </div>
    </section>
  );
}
