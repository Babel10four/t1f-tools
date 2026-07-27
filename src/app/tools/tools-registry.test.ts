import { describe, expect, it } from "vitest";
import {
  ADVANCED_TOOLS,
  EXECUTION_LAYER_SEQUENCE,
  LIVE_TOOLS,
  TOOLS_NAV_SECTIONS,
} from "./tools-registry";

describe("tools-registry (BRAND-001)", () => {
  it("defines focused rep and admin navigation sections", () => {
    expect(TOOLS_NAV_SECTIONS.map((s) => s.id)).toEqual([
      "hub",
      "execution",
      "intel",
      "decision",
      "resources",
      "advanced",
    ]);
    expect(TOOLS_NAV_SECTIONS.map((s) => s.title)).toEqual([
      "Overview",
      "Build & Quote",
      "Research",
      "Policy",
      "Rep Resources",
      "Advanced / Internal",
    ]);
  });

  it("lists four shipped deal tools with stable routes", () => {
    expect(LIVE_TOOLS).toHaveLength(4);
    expect(LIVE_TOOLS.map((t) => t.href)).toEqual([
      "/tools/loan-structuring-assistant",
      "/tools/term-sheet",
      "/tools/cash-to-close-estimator",
      "/tools/pricing-calculator",
    ]);
    expect(LIVE_TOOLS.map((t) => t.label)).toEqual([
      "Deal Structuring Copilot",
      "Deal Sheet Builder",
      "Cash to Close Calculator",
      "Loan Pricing Engine",
    ]);
  });

  it("keeps unfinished tools out of the execution layer", () => {
    expect(LIVE_TOOLS[3]!.href).toBe("/tools/pricing-calculator");
    const seq = EXECUTION_LAYER_SEQUENCE.map((x) =>
      `live:${x.tool.href}`,
    );
    expect(seq).toEqual([
      "live:/tools/loan-structuring-assistant",
      "live:/tools/term-sheet",
      "live:/tools/cash-to-close-estimator",
      "live:/tools/pricing-calculator",
    ]);
  });

  it("places Deal Analyzer only under Advanced / Internal, not in live tools", () => {
    expect(
      LIVE_TOOLS.some((t) => t.href.includes("deal-analyzer")),
    ).toBe(false);
    expect(ADVANCED_TOOLS.map((t) => t.href)).toEqual(["/tools/deal-analyzer"]);
  });

  it("does not surface /tools/pricing in primary nav sections", () => {
    const all = TOOLS_NAV_SECTIONS.flatMap((s) => s.links.map((l) => l.href));
    expect(all.includes("/tools/pricing")).toBe(false);
  });

  it("includes shipped research tools and live Credit Copilot", () => {
    const intel = TOOLS_NAV_SECTIONS.find((s) => s.id === "intel")!;
    expect(intel.links.map((l) => l.href)).toEqual([
      "/tools/borrower-intel",
      "/tools/property-intel",
    ]);
    expect(intel.links.find((l) => l.href === "/tools/borrower-intel")?.isPlaceholder).toBe(
      false,
    );
    expect(intel.links.find((l) => l.href === "/tools/property-intel")?.isPlaceholder).toBe(
      false,
    );
    const decision = TOOLS_NAV_SECTIONS.find((s) => s.id === "decision")!;
    expect(decision.links).toEqual([
      {
        href: "/tools/credit-copilot",
        label: "Credit Copilot",
        isPlaceholder: false,
      },
    ]);
  });
});
