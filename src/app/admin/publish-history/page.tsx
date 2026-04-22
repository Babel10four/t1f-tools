import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Publish History",
  description: "Admin publish audit trail",
};

export default function AdminPublishHistoryPage() {
  return (
    <div className="flex flex-col gap-4" data-testid="admin-publish-history">
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Publish History
      </h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Audit trail for publishes and promotions will appear here when the
        pipeline is connected. No blocking dependencies on other admin tickets.
      </p>
      <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50/80 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
        Zero state — no events recorded yet.
      </div>
    </div>
  );
}
