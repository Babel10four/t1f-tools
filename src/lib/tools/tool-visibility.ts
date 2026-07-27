import type { AuthRole } from "@/lib/auth/constants";
import {
  CREDIT_COPILOT_TOOL,
  ADVANCED_TOOLS,
  EXECUTION_LAYER_SEQUENCE,
  LIVE_INTEL_TOOLS,
  LIVE_TOOLS,
  REP_PERFORMANCE_TOOLS,
  RESOURCES_TOOLS,
  TOOL_HUB,
  TOOLS_NAV_SECTIONS,
  type NavSection,
} from "@/app/tools/tools-registry";
import type { ToolRailItem } from "@/app/tools/tool-rail-config";
import { TOOL_RAIL_ITEMS } from "@/app/tools/tool-rail-config";
import { HUB_PRIMARY_CTA_HREF } from "@/lib/branding";

/** Keep only Hub + shipped tools in rail; placeholders still discoverable on hub cards. */
const RAIL_EXCLUDED_HREFS = new Set<string>();

/**
 * Single map: which roles may see each tool href in hub / rail / ToolsNav.
 * Omitted hrefs default to admin-only in {@link toolAudiencesForHref}.
 */
export const TOOL_HREF_AUDIENCES: Record<string, readonly ("user" | "admin")[]> = {
  [TOOL_HUB.href]: ["user", "admin"],
  /** Internal tool — hidden for standard users. */
  "/tools/loan-structuring-assistant": ["admin"],
  "/tools/term-sheet": ["user", "admin"],
  "/tools/cash-to-close-estimator": ["admin"],
  /** Launch: hide from user until re-enabled (see product / rail red-box scope). */
  "/tools/pricing-calculator": ["admin"],
  "/tools/pricing-comparator": ["admin"],
  "/tools/disclosure-builder": ["admin"],
  "/tools/credit-copilot": ["user", "admin"],
  "/tools/reviews": ["user", "admin"],
  "/tools/email-templates": ["user", "admin"],
  "/tools/deal-analyzer": ["admin"],
  "/tools/market-analyzer": ["admin"],
  "/tools/prospect-researcher": ["admin"],
  "/tools/borrower-intel": ["admin"],
  "/tools/property-intel": ["user", "admin"],
  "/tools/voice-agent": ["admin"],
};

export function toolAudiencesForHref(href: string): ("user" | "admin")[] {
  const key = normalizeToolHref(href);
  const audiences = TOOL_HREF_AUDIENCES[key];
  if (audiences) return [...audiences];
  return ["admin"];
}

function normalizeToolHref(href: string): string {
  if (href === "/tools" || href === "/tools/") return TOOL_HUB.href;
  return href.replace(/\/$/, "") || TOOL_HUB.href;
}

export function hrefVisibleToRole(href: string, role: AuthRole): boolean {
  return toolAudiencesForHref(href).includes(role);
}

export function filterToolRailItems(role: AuthRole): ToolRailItem[] {
  return TOOL_RAIL_ITEMS.filter(
    (item) =>
      hrefVisibleToRole(item.href, role) && !RAIL_EXCLUDED_HREFS.has(item.href),
  );
}

export type HubPageModel = {
  executionSequence: typeof EXECUTION_LAYER_SEQUENCE;
  performanceTools: typeof REP_PERFORMANCE_TOOLS;
  liveIntelTools: typeof LIVE_INTEL_TOOLS;
  resourcesTools: typeof RESOURCES_TOOLS;
  advancedTools: typeof ADVANCED_TOOLS;
};

export function filterHubPageModel(role: AuthRole): HubPageModel {
  if (role === "admin") {
    return {
      executionSequence: EXECUTION_LAYER_SEQUENCE,
      performanceTools: REP_PERFORMANCE_TOOLS,
      liveIntelTools: LIVE_INTEL_TOOLS,
      resourcesTools: RESOURCES_TOOLS,
      advancedTools: ADVANCED_TOOLS,
    };
  }

  const executionSequence = EXECUTION_LAYER_SEQUENCE.filter((item) =>
    hrefVisibleToRole(item.tool.href, role),
  );

  const liveIntelTools = LIVE_INTEL_TOOLS.filter((t) =>
    hrefVisibleToRole(t.href, role),
  );

  const performanceTools = REP_PERFORMANCE_TOOLS.filter((t) =>
    hrefVisibleToRole(t.href, role),
  );

  const resourcesTools = RESOURCES_TOOLS.filter((t) =>
    hrefVisibleToRole(t.href, role),
  );

  const advancedTools = ADVANCED_TOOLS.filter((t) => hrefVisibleToRole(t.href, role));

  return {
    executionSequence,
    performanceTools,
    liveIntelTools,
    resourcesTools,
    advancedTools,
  };
}

export function filterNavSections(role: AuthRole): NavSection[] {
  return TOOLS_NAV_SECTIONS.map((section) => ({
    ...section,
    links: section.links.filter((link) => hrefVisibleToRole(link.href, role)),
  })).filter((section) => section.links.length > 0);
}

export function primaryCtaHrefForRole(_role: AuthRole): string {
  if (_role === "user") {
    return "/tools/term-sheet";
  }
  return HUB_PRIMARY_CTA_HREF;
}

export function primaryCtaLabelForRole(_role: AuthRole): string {
  if (_role === "user") {
    return "Deal Sheet Builder";
  }
  return LIVE_TOOLS[0]!.label;
}

/** Hero paragraph under the hub title — user copy omits JSON harness and admin-only tools. */
export function hubHeroDescriptionForRole(role: AuthRole): string {
  if (role === "user") {
    return "Build lender-ready terms, review monthly performance, research properties, and answer policy questions from one focused workspace.";
  }
  return "Use the same rep workspace, with additional internal tools and reporting available when you need them.";
}

type WorkflowStep = { href: string; label: string };

const WORKFLOW_STEPS: WorkflowStep[] = [
  { href: "/tools/loan-structuring-assistant", label: "1. Structure" },
  { href: "/tools/term-sheet", label: "2. Deal Sheet" },
  { href: "/tools/cash-to-close-estimator", label: "3. Cash to Close" },
  { href: CREDIT_COPILOT_TOOL.href, label: "4. Policy Q&A" },
];

/** Strip leading "N. " from workflow labels so we can renumber after role filtering. */
export function workflowStepTitleWithoutIndex(label: string): string {
  return label.replace(/^\d+\.\s*/, "");
}

export function workflowStepsForRole(role: AuthRole): WorkflowStep[] {
  const filtered = WORKFLOW_STEPS.filter((step) => hrefVisibleToRole(step.href, role));
  return filtered.map((step, i) => ({
    ...step,
    label: `${i + 1}. ${workflowStepTitleWithoutIndex(step.label)}`,
  }));
}
