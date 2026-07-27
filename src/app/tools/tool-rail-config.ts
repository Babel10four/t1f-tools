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
    shortLabel: "Structure",
    title: "Deal Structuring Copilot",
    icon: "layers",
  },
  {
    href: "/tools/term-sheet",
    shortLabel: "Deal Sheet",
    title: "Deal Sheet Builder",
    icon: "file",
  },
  {
    href: "/tools/reviews",
    shortLabel: "Rep Reviews",
    title: "Rep Monthly Reviews",
    icon: "calendar",
  },
  {
    href: "/tools/cash-to-close-estimator",
    shortLabel: "Cash to Close",
    title: "Cash to Close Calculator",
    icon: "cash",
  },
  {
    href: "/tools/pricing-calculator",
    shortLabel: "Pricing",
    title: "Loan Pricing Engine",
    icon: "percent",
  },
  {
    href: "/tools/credit-copilot",
    shortLabel: "Policy Q&A",
    title: "Credit Copilot — focus canvas",
    icon: "sparkles",
  },
  {
    href: "/tools/property-intel",
    shortLabel: "Property",
    title: "Property Intel — Firecrawl + GPT",
    icon: "home",
  },
  {
    href: "/tools/email-templates",
    shortLabel: "Email",
    title: "Email Templates",
    icon: "mail",
  },
  {
    href: "/tools/deal-analyzer",
    shortLabel: "JSON Harness",
    title: "Deal Analyzer JSON harness",
    icon: "wrench",
  },
];
