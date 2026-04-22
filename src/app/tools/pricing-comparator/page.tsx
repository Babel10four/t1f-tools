import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing Comparator",
  description: "Placeholder — pricing comparison tool (execution layer).",
};

export default function PricingComparatorPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Pricing Comparator
      </h1>
    </div>
  );
}
