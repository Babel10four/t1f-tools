import type { ReactNode } from "react";

type DisclosureBannerProps = {
  summary: ReactNode;
  details?: ReactNode;
  tone?: "neutral" | "warning";
  className?: string;
  detailLabel?: string;
};

export function DisclosureBanner({
  summary,
  details,
  tone = "neutral",
  className,
  detailLabel = "Privacy / Disclaimer",
}: DisclosureBannerProps) {
  const toneClass =
    tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-950"
      : "border-zinc-200 bg-zinc-50 text-zinc-800";

  return (
    <section
      className={[
        "rounded-lg border px-4 py-3 text-sm",
        toneClass,
        className ?? "",
      ].join(" ")}
      role="note"
    >
      <p className="leading-relaxed">{summary}</p>
      {details ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium text-zinc-600">
            {detailLabel}
          </summary>
          <div className="mt-2 space-y-1 text-xs leading-relaxed text-zinc-600">
            {details}
          </div>
        </details>
      ) : null}
    </section>
  );
}

