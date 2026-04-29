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

/** User nav (hub + sections): includes Credit Copilot + Rural Checker — not duplicated on rail. */
const USER_NAV_HREFS = new Set([
  "/tools",
  "/tools/term-sheet",
  "/tools/rural-checker",
  "/tools/credit-copilot",
]);

/** User rail: same core user-visible tools on the left rail. */
const USER_RAIL_HREFS = new Set([
  "/tools",
  "/tools/term-sheet",
  "/tools/rural-checker",
  "/tools/credit-copilot",
]);

const USER_HIDDEN_HREFS = new Set([
  "/tools/loan-structuring-assistant",
  "/tools/pricing-calculator",
  "/tools/pricing-comparator",
  "/tools/disclosure-builder",
  "/tools/deal-analyzer",
]);

describe("tool-visibility (launch restriction)", () => {
  it("documents every tool rail href in TOOL_HREF_AUDIENCES (default admin-only otherwise)", () => {
    for (const item of TOOL_RAIL_ITEMS) {
      expect(TOOL_HREF_AUDIENCES, `missing audiences for ${item.href}`).toHaveProperty(item.href);
    }
  });

  it("user sees only hub + sheet + policy in rail/nav; admin tools stay hidden", () => {
    const railHrefs = filterToolRailItems("user").map((i) => i.href);
    expect(new Set(railHrefs)).toEqual(USER_RAIL_HREFS);

    const navHrefs = new Set(
      filterNavSections("user").flatMap((s) => s.links.map((l) => l.href)),
    );
    expect(navHrefs).toEqual(USER_NAV_HREFS);

    for (const href of USER_HIDDEN_HREFS) {
      expect(railHrefs).not.toContain(href);
      expect(navHrefs.has(href)).toBe(false);
    }
  });

  it("user hub model hides intel and advanced; execution shows sheet + rural", () => {
    const hub = filterHubPageModel("user");
    expect(hub.showIntelSection).toBe(false);
    expect(hub.showAdvancedSection).toBe(false);
    expect(hub.intelPlaceholders).toHaveLength(0);
    expect(hub.advancedTools).toHaveLength(0);
    expect(hub.executionSequence).toHaveLength(2);
    expect(hub.executionSequence.map((x) => x.tool.href)).toEqual([
      "/tools/term-sheet",
      "/tools/rural-checker",
    ]);
  });

  it("user primary CTA points to Deal Sheet Builder", () => {
    expect(primaryCtaHrefForRole("user")).toBe("/tools/term-sheet");
  });

  it("admin rail and nav keep full canonical list", () => {
    expect(filterToolRailItems("admin").map((i) => i.href)).toEqual(
      TOOL_RAIL_ITEMS.map((i) => i.href),
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
