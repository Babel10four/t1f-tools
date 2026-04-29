import type { AuthRole } from "@/lib/auth/constants";
import {
  CREDIT_COPILOT_TOOL,
  ADVANCED_TOOLS,
  EXECUTION_LAYER_SEQUENCE,
  INTEL_PLACEHOLDER_TOOLS,
  LIVE_TOOLS,
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
  "/tools/rural-checker": ["user", "admin"],
  "/tools/disclosure-builder": ["admin"],
  "/tools/credit-copilot": ["user", "admin"],
  "/tools/deal-analyzer": ["admin"],
  "/tools/market-analyzer": ["admin"],
  "/tools/prospect-researcher": ["admin"],
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
  showIntelSection: boolean;
  intelPlaceholders: typeof INTEL_PLACEHOLDER_TOOLS;
  showAdvancedSection: boolean;
  advancedTools: typeof ADVANCED_TOOLS;
};

export function filterHubPageModel(role: AuthRole): HubPageModel {
  if (role === "admin") {
    return {
      executionSequence: EXECUTION_LAYER_SEQUENCE,
      showIntelSection: true,
      intelPlaceholders: INTEL_PLACEHOLDER_TOOLS,
      showAdvancedSection: true,
      advancedTools: ADVANCED_TOOLS,
    };
  }

  const executionSequence = EXECUTION_LAYER_SEQUENCE.filter((item) =>
    hrefVisibleToRole(item.tool.href, role),
  );

  const intelPlaceholders = INTEL_PLACEHOLDER_TOOLS.filter((t) =>
    hrefVisibleToRole(t.href, role),
  );

  const advancedTools = ADVANCED_TOOLS.filter((t) => hrefVisibleToRole(t.href, role));

  return {
    executionSequence,
    showIntelSection: intelPlaceholders.length > 0,
    intelPlaceholders,
    showAdvancedSection: advancedTools.length > 0,
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
    return "Start with Deal Sheet Builder to shape lender-ready terms, screen rural eligibility from the hub or Rural Checker (Census-backed context — not a legal determination), then use Credit Copilot for policy questions. Advanced execution tools stay available in admin mode.";
  }
  return "Pick a tool below or use the JSON harness under Advanced / Internal when you need raw requests — not a generic loan portal.";
}

type WorkflowStep = { href: string; label: string };

const WORKFLOW_STEPS: WorkflowStep[] = [
  { href: "/tools/loan-structuring-assistant", label: "1. Structure" },
  { href: "/tools/term-sheet", label: "2. Deal Sheet" },
  { href: "/tools/cash-to-close-estimator", label: "3. Cash to Close" },
  { href: CREDIT_COPILOT_TOOL.href, label: "4. Policy Q&A" },
];

export function workflowStepsForRole(role: AuthRole): WorkflowStep[] {
  return WORKFLOW_STEPS.filter((step) => hrefVisibleToRole(step.href, role));
}
