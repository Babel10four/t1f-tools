import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getSessionPayload } from "@/lib/auth/session-server";

const REP_REVIEWS_URL =
  "https://ae-deep-dives.barrett248037.chatgpt.site";
const MANAGER_OVERVIEW_URL =
  "https://ae-deep-dives-manager.barrett248037.chatgpt.site";

export const metadata: Metadata = {
  title: "Rep Reviews",
  description:
    "Monthly coaching and performance reviews for Tier One Funding account executives.",
};

const REVIEW_CONTENT = [
  {
    label: "Performance readout",
    description:
      "A clear view of the month’s results, momentum, and the numbers that matter most.",
  },
  {
    label: "Coaching focus",
    description:
      "Specific behaviors and opportunities to carry into the next one-on-one.",
  },
  {
    label: "Next-month priorities",
    description:
      "A short set of practical actions that connect the review to the work ahead.",
  },
] as const;

export default async function RepReviewsPage() {
  const session = await getSessionPayload();
  const role = session?.role ?? "user";

  return (
    <div className="flex flex-col gap-7">
      <header className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-chrome)] p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">
            Rep performance
          </p>
          <Badge tone="ready">Ready</Badge>
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-[var(--text-primary)]">
          Rep Monthly Reviews
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--text-muted)]">
          Open the current coaching and performance library, choose a rep or
          reporting month, and walk into the next one-on-one with a focused plan.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="relative overflow-hidden border-t-4 border-t-[var(--brand)] p-6 sm:p-7">
          <div
            aria-hidden
            className="absolute -right-10 -top-12 size-32 rounded-full bg-[var(--brand-muted)]"
          />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Review library
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text-primary)]">
              Account Executive Deep Dives
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--text-muted)]">
              Monthly coaching and performance briefs for the sales team,
              organized for quick review before a one-on-one.
            </p>
            <a
              href={REP_REVIEWS_URL}
              target="_blank"
              rel="noreferrer"
              className={buttonClassName("primary", "md", "mt-6 w-fit")}
            >
              Open monthly reviews
              <span aria-hidden>↗</span>
            </a>
          </div>
        </Card>

        {role === "admin" ? (
          <Card className="border-t-4 border-t-amber-400 p-6 sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Manager view
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text-primary)]">
              Team Overview
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--text-muted)]">
              Compare every rep across the same development funnel and spot the
              coaching themes that need attention across the team.
            </p>
            <a
              href={MANAGER_OVERVIEW_URL}
              target="_blank"
              rel="noreferrer"
              className={buttonClassName("secondary", "md", "mt-6 w-fit")}
            >
              Open manager overview
              <span aria-hidden>↗</span>
            </a>
          </Card>
        ) : (
          <Card className="bg-[var(--surface-soft)] p-6 shadow-none sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--brand)]">
              Review rhythm
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text-primary)]">
              Turn the review into a working plan
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
              Use the monthly brief to set one coaching focus, one measurable
              priority, and the next checkpoint.
            </p>
          </Card>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
          What you’ll find in each review
        </h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {REVIEW_CONTENT.map((item, index) => (
            <div
              key={item.label}
              className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-chrome)] p-5"
            >
              <span className="grid size-7 place-items-center rounded-lg bg-[var(--brand-muted)] text-xs font-bold text-[var(--brand)]">
                {index + 1}
              </span>
              <h3 className="mt-4 text-sm font-semibold text-[var(--text-primary)]">
                {item.label}
              </h3>
              <p className="mt-1.5 text-sm leading-6 text-[var(--text-muted)]">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <p className="text-xs leading-5 text-[var(--text-muted)]">
        Reviews continue to be maintained in the existing Deep Dives workspace;
        this page gives them a permanent home inside T1F Tools.
      </p>
    </div>
  );
}
