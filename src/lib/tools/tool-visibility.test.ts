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

const USER_ALLOWED_HREFS = new Set([
  "/tools",
  "/tools/term-sheet",
  "/tools/credit-copilot",
]);

describe("tool-visibility (launch restriction)", () => {
  it("documents every tool rail href in TOOL_HREF_AUDIENCES (default admin-only otherwise)", () => {
    for (const item of TOOL_RAIL_ITEMS) {
      expect(TOOL_HREF_AUDIENCES, `missing audiences for ${item.href}`).toHaveProperty(item.href);
    }
  });

  it("user sees only hub, Deal Sheet Builder, and Credit Copilot in rail + nav", () => {
    const railHrefs = filterToolRailItems("user").map((i) => i.href);
    expect(new Set(railHrefs)).toEqual(USER_ALLOWED_HREFS);

    const navHrefs = new Set(
      filterNavSections("user").flatMap((s) => s.links.map((l) => l.href)),
    );
    expect(navHrefs).toEqual(USER_ALLOWED_HREFS);
  });

  it("user hub model hides intel and advanced; execution is term sheet only", () => {
    const hub = filterHubPageModel("user");
    expect(hub.showIntelSection).toBe(false);
    expect(hub.showAdvancedSection).toBe(false);
    expect(hub.intelPlaceholders).toHaveLength(0);
    expect(hub.advancedTools).toHaveLength(0);
    expect(hub.executionSequence).toHaveLength(1);
    expect(hub.executionSequence[0]).toMatchObject({
      kind: "live",
      tool: { href: "/tools/term-sheet" },
    });
  });

  it("user primary CTA targets Deal Sheet Builder", () => {
    expect(primaryCtaHrefForRole("user")).toBe("/tools/term-sheet");
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
