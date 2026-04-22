import type { SVGProps } from "react";

const iconClass = "h-5 w-5 shrink-0";

export function IconHub(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass} aria-hidden {...props}>
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconLayers(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass} aria-hidden {...props}>
      <path
        d="m12 4 9 5-9 5-9-5 9-5Zm-9 7.5 9 5 9-5M3 16.5l9 5 9-5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconFile(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass} aria-hidden {...props}>
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  );
}

export function IconCash(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass} aria-hidden {...props}>
      <path
        d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconPercent(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass} aria-hidden {...props}>
      <path
        d="M9 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm12 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM21 3 3 21"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconMap(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass} aria-hidden {...props}>
      <path
        d="M9 20 3 17V4l6 3 6-3 6 3v13l-6 3-6-3-6 3Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M9 4v16" stroke="currentColor" strokeWidth="1.75" />
      <path d="M15 7v16" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

export function IconScale(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass} aria-hidden {...props}>
      <path
        d="m16 16 3 3M3 21h18M6 16l6-12 6 12M9 16h6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconClipboard(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass} aria-hidden {...props}>
      <path
        d="M9 4h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path d="M9 4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

export function IconSparkles(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass} aria-hidden {...props}>
      <path
        d="M9.5 2 11 6l4 .5-4 2L9.5 14 8 10 4 9.5 8 7.5 9.5 2Zm8 8 1.5 3L22 14l-3 1 1.5 3-3.5-1.5L13 21l1-3.5-3-1 3.5-1L17.5 10Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconWrench(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass} aria-hidden {...props}>
      <path
        d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76a1 1 0 0 1-1.41 0Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

export type RailIconId =
  | "hub"
  | "layers"
  | "file"
  | "cash"
  | "percent"
  | "map"
  | "scale"
  | "clipboard"
  | "sparkles"
  | "wrench";

export function ToolRailIcon({ id }: { id: RailIconId }) {
  switch (id) {
    case "hub":
      return <IconHub />;
    case "layers":
      return <IconLayers />;
    case "file":
      return <IconFile />;
    case "cash":
      return <IconCash />;
    case "percent":
      return <IconPercent />;
    case "map":
      return <IconMap />;
    case "scale":
      return <IconScale />;
    case "clipboard":
      return <IconClipboard />;
    case "sparkles":
      return <IconSparkles />;
    case "wrench":
      return <IconWrench />;
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}
