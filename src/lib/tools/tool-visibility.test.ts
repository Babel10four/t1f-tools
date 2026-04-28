import { describe, expect, it } from "vitest";
import { TOOL_RAIL_ITEMS } from "@/app/tools/tool-rail-config";
import { TOOLS_NAV_SECTIONS } from "@/app/tools/tools-registry";
import {
  filterHubPageModel,
  filterNavSections,
  filterToolRailItems,
  hrefVisibleToRole,
  primaryCtaHrefForRole,
  TOOL_HREF_AUDIENCES,
  toolAudiencesForHref,
} from "./tool-visibility";

/** User nav (hub + sections): includes Credit Copilot link — not duplicated on rail. */
const USER_NAV_HREFS = new Set([
  "/tools",
  "/tools/term-sheet",
  "/tools/cash-to-close-estimator",
  "/tools/credit-copilot",
]);

/** User rail: same as nav minus Credit Copilot (panel is always adjacent). */
const USER_RAIL_HREFS = new Set([
  "/tools",
  "/tools/term-sheet",
  "/tools/cash-to-close-estimator",
]);

const USER_HIDDEN_HREFS = new Set([
  "/tools/loan-structuring-assistant",
  "/tools/pricing-calculator",
  "/tools/pricing-comparator",
  "/tools/rural-checker",
  "/tools/disclosure-builder",
  "/tools/deal-analyzer",
]);

describe("tool-visibility (launch restriction)", () => {
  it("documents every tool rail href in TOOL_HREF_AUDIENCES (default admin-only otherwise)", () => {
    for (const item of TOOL_RAIL_ITEMS) {
      expect(TOOL_HREF_AUDIENCES, `missing audiences for ${item.href}`).toHaveProperty(item.href);
    }
  });

  it("user sees hub, sheet / cash on rail (no Policy duplicate); nav adds Credit Copilot; hidden admin tools absent", () => {
    const railHrefs = filterToolRailItems("user").map((i) => i.href);
    expect(new Set(railHrefs)).toEqual(USER_RAIL_HREFS);
    expect(railHrefs).not.toContain("/tools/credit-copilot");

    const navHrefs = new Set(
      filterNavSections("user").flatMap((s) => s.links.map((l) => l.href)),
    );
    expect(navHrefs).toEqual(USER_NAV_HREFS);

    for (const href of USER_HIDDEN_HREFS) {
      expect(railHrefs).not.toContain(href);
      expect(navHrefs.has(href)).toBe(false);
    }
  });

  it("user hub model hides intel and advanced; execution is sheet + cash only", () => {
    const hub = filterHubPageModel("user");
    expect(hub.showIntelSection).toBe(false);
    expect(hub.showAdvancedSection).toBe(false);
    expect(hub.intelPlaceholders).toHaveLength(0);
    expect(hub.advancedTools).toHaveLength(0);
    expect(hub.executionSequence).toHaveLength(2);
    expect(hub.executionSequence.map((x) => x.tool.href)).toEqual([
      "/tools/term-sheet",
      "/tools/cash-to-close-estimator",
    ]);
  });

  it("user primary CTA points to Deal Sheet Builder", () => {
    expect(primaryCtaHrefForRole("user")).toBe("/tools/term-sheet");
  });

  it("admin rail omits Credit Copilot shortcut; nav is full canonical list", () => {
    expect(filterToolRailItems("admin").map((i) => i.href)).toEqual(
      TOOL_RAIL_ITEMS.filter((i) => i.href !== "/tools/credit-copilot").map(
        (i) => i.href,
      ),
    );
    expect(filterNavSections("admin")).toEqual(TOOLS_NAV_SECTIONS);
  });

  it("admin hub model matches unfiltered execution, intel, and advanced", () => {
    const hub = filterHubPageModel("admin");
    expect(hub.showIntelSection).toBe(true);
    expect(hub.showAdvancedSection).toBe(true);
    expect(hub.intelPlaceholders.length).toBeGreaterThan(0);
    expect(hub.advancedTools.length).toBeGreaterThan(0);
  });

  it("toolAudiencesForHref returns admin-only for unknown hrefs", () => {
    expect(toolAudiencesForHref("/tools/unknown-tool")).toEqual(["admin"]);
    expect(hrefVisibleToRole("/tools/unknown-tool", "user")).toBe(false);
    expect(hrefVisibleToRole("/tools/unknown-tool", "admin")).toBe(true);
  });
});
