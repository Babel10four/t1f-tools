import { describe, expect, it } from "vitest";
import {
  ADVANCED_TOOLS,
  EXECUTION_LAYER_SEQUENCE,
  LIVE_TOOLS,
  TOOLS_NAV_SECTIONS,
} from "./tools-registry";

describe("tools-registry (BRAND-001)", () => {
  it("defines nav sections: Overview, Execution, Intel, Decision, Advanced / Internal", () => {
    expect(TOOLS_NAV_SECTIONS.map((s) => s.id)).toEqual([
      "hub",
      "execution",
      "intel",
      "decision",
      "advanced",
    ]);
    expect(TOOLS_NAV_SECTIONS.map((s) => s.title)).toEqual([
      "Overview",
      "Execution Layer",
      "Intel Layer",
      "Decision Layer",
      "Advanced / Internal",
    ]);
  });

  it("lists five live tools with BRAND-001 display names and stable routes", () => {
    expect(LIVE_TOOLS).toHaveLength(5);
    expect(LIVE_TOOLS.map((t) => t.href)).toEqual([
      "/tools/loan-structuring-assistant",
      "/tools/term-sheet",
      "/tools/cash-to-close-estimator",
      "/tools/pricing-calculator",
      "/tools/rural-checker",
    ]);
    expect(LIVE_TOOLS.map((t) => t.label)).toEqual([
      "Deal Structuring Copilot",
      "Deal Sheet Builder",
      "Cash to Close Calculator",
      "Loan Pricing Engine",
      "Rural Eligibility Checker",
    ]);
  });

  it("orders execution layer with comparator stub between pricing engine and rural checker", () => {
    expect(LIVE_TOOLS[3]!.href).toBe("/tools/pricing-calculator");
    expect(LIVE_TOOLS[4]!.href).toBe("/tools/rural-checker");
    const seq = EXECUTION_LAYER_SEQUENCE.map((x) =>
      x.kind === "live" ? `live:${x.tool.href}` : `ph:${x.tool.href}`,
    );
    expect(seq).toEqual([
      "live:/tools/loan-structuring-assistant",
      "live:/tools/term-sheet",
      "live:/tools/cash-to-close-estimator",
      "live:/tools/pricing-calculator",
      "ph:/tools/pricing-comparator",
      "live:/tools/rural-checker",
      "ph:/tools/disclosure-builder",
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

  it("includes intel placeholders and live Credit Copilot in Decision layer", () => {
    const intel = TOOLS_NAV_SECTIONS.find((s) => s.id === "intel")!;
    expect(intel.links.map((l) => l.href)).toEqual([
      "/tools/market-analyzer",
      "/tools/prospect-researcher",
      "/tools/voice-agent",
    ]);
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
