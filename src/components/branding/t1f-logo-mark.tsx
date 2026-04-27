/**
 * Compact T1F mark for auth chrome — matches workbench brand green (BRAND-001).
 */
export function T1fLogoMark({
  className = "",
  size = 40,
}: {
  className?: string;
  /** Square tile edge length in px */
  size?: number;
}) {
  const s = `${size}px`;
  return (
    <div
      className={`flex shrink-0 items-center gap-2.5 ${className}`.trim()}
      aria-hidden
    >
      <div
        className="flex items-center justify-center rounded-sm font-bold text-[var(--brand-foreground)] shadow-sm"
        style={{
          width: s,
          height: s,
          backgroundColor: "var(--brand)",
          fontSize: `${Math.round(size * 0.42)}px`,
        }}
      >
        T
      </div>
      <span
        className="font-bold tracking-tight text-[var(--brand)]"
        style={{ fontSize: `${Math.round(size * 0.52)}px` }}
      >
        T1F
      </span>
    </div>
  );
}
