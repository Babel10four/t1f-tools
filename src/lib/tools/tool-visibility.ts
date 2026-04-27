import type { AuthRole } from "@/lib/auth/constants";
import {
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

/** Credit Copilot lives in the workbench rail panel — hide duplicate rail shortcut. */
const RAIL_EXCLUDED_HREFS = new Set<string>(["/tools/credit-copilot"]);

/**
 * Single map: which roles may see each tool href in hub / rail / ToolsNav.
 * Omitted hrefs default to admin-only in {@link toolAudiencesForHref}.
 */
export const TOOL_HREF_AUDIENCES: Record<string, readonly ("user" | "admin")[]> = {
  [TOOL_HUB.href]: ["user", "admin"],
  /** Rep workflows — visible to standard users. */
  "/tools/loan-structuring-assistant": ["user", "admin"],
  "/tools/term-sheet": ["user", "admin"],
  "/tools/cash-to-close-estimator": ["user", "admin"],
  /** Launch: hide from user until re-enabled (see product / rail red-box scope). */
  "/tools/pricing-calculator": ["admin"],
  "/tools/pricing-comparator": ["admin"],
  "/tools/rural-checker": ["admin"],
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
  return HUB_PRIMARY_CTA_HREF;
}

export function primaryCtaLabelForRole(_role: AuthRole): string {
  return LIVE_TOOLS[0]!.label;
}

/** Hero paragraph under the hub title — user copy omits JSON harness and admin-only tools. */
export function hubHeroDescriptionForRole(role: AuthRole): string {
  if (role === "user") {
    return "Use Deal Structuring, Deal Sheet Builder, and Cash to Close for analyze-backed workflows, or Credit Copilot for policy Q&A. Loan pricing, rural screening, disclosure stubs, and the JSON harness stay in the full workbench for elevated access.";
  }
  return "Pick a tool below or use the JSON harness under Advanced / Internal when you need raw requests — not a generic loan portal.";
}
