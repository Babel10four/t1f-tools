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

/** User rail + nav: core rep tools; excludes pricing, comparator, rural, disclosure, JSON (launch). */
const USER_ALLOWED_HREFS = new Set([
  "/tools",
  "/tools/loan-structuring-assistant",
  "/tools/term-sheet",
  "/tools/cash-to-close-estimator",
  "/tools/credit-copilot",
]);

const USER_HIDDEN_HREFS = new Set([
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

  it("user sees hub, deal / sheet / cash / policy in rail + nav; not pricing/compare/rural/discl/json", () => {
    const railHrefs = filterToolRailItems("user").map((i) => i.href);
    expect(new Set(railHrefs)).toEqual(USER_ALLOWED_HREFS);

    const navHrefs = new Set(
      filterNavSections("user").flatMap((s) => s.links.map((l) => l.href)),
    );
    expect(navHrefs).toEqual(USER_ALLOWED_HREFS);

    for (const href of USER_HIDDEN_HREFS) {
      expect(railHrefs).not.toContain(href);
      expect(navHrefs.has(href)).toBe(false);
    }
  });

  it("user hub model hides intel and advanced; execution is deal + sheet + cash only", () => {
    const hub = filterHubPageModel("user");
    expect(hub.showIntelSection).toBe(false);
    expect(hub.showAdvancedSection).toBe(false);
    expect(hub.intelPlaceholders).toHaveLength(0);
    expect(hub.advancedTools).toHaveLength(0);
    expect(hub.executionSequence).toHaveLength(3);
    expect(hub.executionSequence.map((x) => x.tool.href)).toEqual([
      "/tools/loan-structuring-assistant",
      "/tools/term-sheet",
      "/tools/cash-to-close-estimator",
    ]);
  });

  it("user primary CTA matches hub default (Deal Structuring Copilot)", () => {
    expect(primaryCtaHrefForRole("user")).toBe("/tools/loan-structuring-assistant");
  });

  it("admin rail and nav match full canonical lists (no accidental filtering)", () => {
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
