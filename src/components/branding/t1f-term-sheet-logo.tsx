/** BRAND-001 term sheet wordmark green */
const T1F_WORDMARK_GREEN = "#285c2e";

type T1fTermSheetLogoProps = {
  className?: string;
};

/**
 * Official T1F wordmark for term sheets: bold italic “T1F” in brand green (matches BRAND-001).
 * Renders as SVG text so it stays sharp at any size without a raster asset.
 */
export function T1fTermSheetLogo({ className = "" }: T1fTermSheetLogoProps) {
  return (
    <svg
      className={className}
      width="108"
      height="32"
      viewBox="0 0 108 32"
      role="img"
      aria-label="T1F"
      xmlns="http://www.w3.org/2000/svg"
    >
      <text
        x="0"
        y="25"
        fill={T1F_WORDMARK_GREEN}
        fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif"
        fontSize="26"
        fontWeight="900"
        fontStyle="italic"
        letterSpacing="-0.06em"
        transform="skewX(-10)"
      >
        T1F
      </text>
    </svg>
  );
}
