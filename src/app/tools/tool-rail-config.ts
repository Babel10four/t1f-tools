import type { RailIconId } from "./tool-rail-icons";

export type ToolRailItem = {
  href: string;
  /** Short label next to icon on desktop rail */
  shortLabel: string;
  /** Accessible name + tooltip */
  title: string;
  icon: RailIconId;
  /** Greyed out with dashed border — still navigates to stub page */
  placeholder?: boolean;
};

/**
 * Ordered tool rail — navigation only (Credit Copilot chat lives in the next column).
 */
export const TOOL_RAIL_ITEMS: ToolRailItem[] = [
  {
    href: "/tools",
    shortLabel: "Hub",
    title: "Tool hub overview",
    icon: "hub",
  },
  {
    href: "/tools/loan-structuring-assistant",
    shortLabel: "Deal",
    title: "Deal Structuring Copilot",
    icon: "layers",
  },
  {
    href: "/tools/term-sheet",
    shortLabel: "Sheet",
    title: "Deal Sheet Builder",
    icon: "file",
  },
  {
    href: "/tools/cash-to-close-estimator",
    shortLabel: "Cash",
    title: "Cash to Close Calculator",
    icon: "cash",
  },
  {
    href: "/tools/pricing-calculator",
    shortLabel: "Price",
    title: "Loan Pricing Engine",
    icon: "percent",
  },
  {
    href: "/tools/pricing-comparator",
    shortLabel: "Compare",
    title: "Pricing Comparator (coming soon)",
    icon: "scale",
    placeholder: true,
  },
  {
    href: "/tools/rural-checker",
    shortLabel: "Rural",
    title: "Rural Eligibility Checker",
    icon: "map",
  },
  {
    href: "/tools/disclosure-builder",
    shortLabel: "Discl.",
    title: "Disclosure Builder (coming soon)",
    icon: "clipboard",
    placeholder: true,
  },
  {
    href: "/tools/credit-copilot",
    shortLabel: "Policy",
    title: "Credit Copilot — focus canvas",
    icon: "sparkles",
  },
  {
    href: "/tools/deal-analyzer",
    shortLabel: "JSON",
    title: "Deal Analyzer JSON harness",
    icon: "wrench",
  },
];
