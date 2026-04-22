import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Market Intel",
  description: "Placeholder — market researcher (intel layer).",
};

export default function MarketIntelPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Market Intel
      </h1>
    </div>
  );
}
