import type { Metadata } from "next";
import { listRuleSets } from "@/lib/rule-sets/service";
import { RulesManager } from "./rules-manager";

export const metadata: Metadata = {
  title: "Rule Sets & Rates",
  description: "Admin rules and rates (CONFIG-001)",
};

export const dynamic = "force-dynamic";

export default async function AdminRulesPage() {
  let initial: Awaited<ReturnType<typeof listRuleSets>> | null = null;
  let errorMessage: string | null = null;

  try {
    initial = await listRuleSets();
  } catch (e) {
    errorMessage =
      e instanceof Error
        ? e.message
        : "Database unavailable. Set DATABASE_URL and apply migrations (see README).";
  }

  if (errorMessage || !initial) {
    return (
      <div className="flex flex-col gap-4" data-testid="admin-rules">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Rule Sets & Rates
        </h1>
        <p className="text-sm text-red-700 dark:text-red-300" role="alert">
          {errorMessage ?? "Rule sets unavailable."}
        </p>
      </div>
    );
  }

  return <RulesManager initial={initial} />;
}
