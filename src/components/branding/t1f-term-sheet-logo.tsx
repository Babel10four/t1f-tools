/** PNG in `public/` — term sheet preview + PDF branding. */
export const TERM_SHEET_LOGO_SRC = "/t1f-logo-green.png";

/** Intrinsic dimensions of `TERM_SHEET_LOGO_SRC` (for layout / PDF sizing). */
export const TERM_SHEET_LOGO_INTRINSIC = {
  width: 1023,
  height: 246,
} as const;

type T1fTermSheetLogoProps = {
  className?: string;
};

/**
 * T1F logo for term sheet header (preview). PDF export loads the same path via fetch.
 */
export function T1fTermSheetLogo({ className = "" }: T1fTermSheetLogoProps) {
  return (
    <img
      src={TERM_SHEET_LOGO_SRC}
      alt="T1F"
      width={TERM_SHEET_LOGO_INTRINSIC.width}
      height={TERM_SHEET_LOGO_INTRINSIC.height}
      className={`h-8 w-auto max-w-full ${className}`}
    />
  );
}
