type T1fTermSheetLogoProps = {
  className?: string;
};

/**
 * Lightweight wordmark for term sheet documents.
 * Uses inline SVG so preview and export styling stay deterministic.
 */
export function T1fTermSheetLogo({ className = "" }: T1fTermSheetLogoProps) {
  return (
    <div className={`inline-flex items-center gap-3 ${className}`.trim()} aria-label="T1F logo">
      <svg
        width="78"
        height="30"
        viewBox="0 0 78 30"
        role="img"
        aria-label="T1F mark"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g fill="#2B7A3D">
          <path d="M4 5h18l-4 6H0z" />
          <path d="M24 5h18l-4 6H20z" />
          <path d="M14 14h18l-4 6H10z" />
          <path d="M34 14h18l-4 6H30z" />
          <path d="M44 5h18l-4 6H40z" />
          <path d="M54 14h18l-4 6H50z" />
        </g>
      </svg>
      <span className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        T1F
      </span>
    </div>
  );
}
