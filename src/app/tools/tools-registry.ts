/**
 * Single source of truth for /tools hub + shell navigation (TICKET-006, BRAND-001).
 * Keep labels, hrefs, and group membership in sync here only. Routes stay fixed — display names only.
 *
 * Role-based **visibility** (user vs admin) is filtered at render time — see
 * {@link TOOL_HREF_AUDIENCES} in `@/lib/tools/tool-visibility` (do not fork href lists there).
 */

export type LiveToolDef = {
  href: string;
  label: string;
  /** One-line workflow description for hub cards. */
  description: string;
  ctaLabel: string;
};

export type AdvancedToolDef = {
  href: string;
  label: string;
  description: string;
  ctaLabel: string;
};

export type ComingSoonToolDef = {
  href: string;
  label: string;
};

/** Primary CTA on the hub: first live execution tool (Deal Structuring Copilot). */
export const HUB_PRIMARY_CTA_HREF = "/tools/loan-structuring-assistant" as const;

export const TOOL_HUB = {
  href: "/tools",
  navLabel: "Overview",
} as const;

/** Shipped execution tools — routes unchanged; labels are BRAND-001 display names. */
export const LIVE_TOOLS: LiveToolDef[] = [
  {
    href: "/tools/loan-structuring-assistant",
    label: "Deal Structuring Copilot",
    description:
      "Guided Bridge purchase and refinance inputs with full deal analysis results.",
    ctaLabel: "Open",
  },
  {
    href: "/tools/term-sheet",
    label: "Deal Sheet Builder",
    description:
      "Internal HTML term-sheet preview from deal analysis — indicative, non-binding.",
    ctaLabel: "Open",
  },
  {
    href: "/tools/cash-to-close-estimator",
    label: "Cash to Close Calculator",
    description:
      "Cash-to-close-first view of line items and totals from deal analysis.",
    ctaLabel: "Open",
  },
  {
    href: "/tools/pricing-calculator",
    label: "Loan Pricing Engine",
    description:
      "Pricing-first layout for rate readiness and policy context from the same analyze API.",
    ctaLabel: "Open",
  },
  {
    href: "/tools/rural-checker",
    label: "Rural Eligibility Checker",
    description:
      "Internal screening from published rural_rules — not a final determination; optional policy metadata only.",
    ctaLabel: "Open",
  },
];

export const PRICING_COMPARATOR_PLACEHOLDER: ComingSoonToolDef = {
  href: "/tools/pricing-comparator",
  label: "Pricing Comparator",
};

export const DISCLOSURE_BUILDER_PLACEHOLDER: ComingSoonToolDef = {
  href: "/tools/disclosure-builder",
  label: "Disclosure Builder",
};

export const INTEL_PLACEHOLDER_TOOLS: ComingSoonToolDef[] = [
  { href: "/tools/market-analyzer", label: "Market Intel" },
  { href: "/tools/prospect-researcher", label: "Prospect Intel" },
  { href: "/tools/voice-agent", label: "Voice Operator" },
];

/** Decision layer — live (TICKET-009). */
export const CREDIT_COPILOT_TOOL: LiveToolDef = {
  href: "/tools/credit-copilot",
  label: "Credit Copilot",
  description:
    "Internal Q&A on the published credit policy (extracted text only) — not an underwriting decision.",
  ctaLabel: "Open",
};

/**
 * Execution layer order on the hub: four live tools, comparator (stub), rural (live), disclosure (stub).
 */
export const EXECUTION_LAYER_SEQUENCE: Array<
  | { kind: "live"; tool: LiveToolDef }
  | { kind: "placeholder"; tool: ComingSoonToolDef }
> = [
  { kind: "live", tool: LIVE_TOOLS[0]! },
  { kind: "live", tool: LIVE_TOOLS[1]! },
  { kind: "live", tool: LIVE_TOOLS[2]! },
  { kind: "live", tool: LIVE_TOOLS[3]! },
  { kind: "placeholder", tool: PRICING_COMPARATOR_PLACEHOLDER },
  { kind: "live", tool: LIVE_TOOLS[4]! },
  { kind: "placeholder", tool: DISCLOSURE_BUILDER_PLACEHOLDER },
];

export const ADVANCED_TOOLS: AdvancedToolDef[] = [
  {
    href: "/tools/deal-analyzer",
    label: "Deal Analyzer (JSON harness)",
    description:
      "Advanced: paste raw JSON for POST /api/deal/analyze — for contract checks and power users.",
    ctaLabel: "Open harness",
  },
];

export type NavLink = {
  href: string;
  label: string;
  isPlaceholder: boolean;
};

export type NavSection = {
  id: "hub" | "execution" | "intel" | "decision" | "advanced";
  title: string;
  links: NavLink[];
};

export const TOOLS_NAV_SECTIONS: NavSection[] = [
  {
    id: "hub",
    title: "Overview",
    links: [
      { href: TOOL_HUB.href, label: TOOL_HUB.navLabel, isPlaceholder: false },
    ],
  },
  {
    id: "execution",
    title: "Execution Layer",
    links: EXECUTION_LAYER_SEQUENCE.map((item) =>
      item.kind === "live"
        ? {
            href: item.tool.href,
            label: item.tool.label,
            isPlaceholder: false,
          }
        : {
            href: item.tool.href,
            label: item.tool.label,
            isPlaceholder: true,
          },
    ),
  },
  {
    id: "intel",
    title: "Intel Layer",
    links: INTEL_PLACEHOLDER_TOOLS.map((t) => ({
      href: t.href,
      label: t.label,
      isPlaceholder: true,
    })),
  },
  {
    id: "decision",
    title: "Decision Layer",
    links: [
      {
        href: CREDIT_COPILOT_TOOL.href,
        label: CREDIT_COPILOT_TOOL.label,
        isPlaceholder: false,
      },
    ],
  },
  {
    id: "advanced",
    title: "Advanced / Internal",
    links: ADVANCED_TOOLS.map((t) => ({
      href: t.href,
      label: t.label,
      isPlaceholder: false,
    })),
  },
];
