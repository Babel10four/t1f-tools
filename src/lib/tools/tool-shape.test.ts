import { describe, expect, it } from "vitest";
import {
  CREDIT_COPILOT_TOOL,
  LIVE_INTEL_TOOLS,
  LIVE_TOOLS,
  RESOURCES_TOOLS,
} from "@/app/tools/tools-registry";
import { TOOL_HREF_AUDIENCES } from "@/lib/tools/tool-visibility";
import {
  getToolShape,
  getToolStatus,
  TOOL_SHAPES,
  TOOL_STATUS,
  TOOL_STATUS_LABEL,
} from "@/lib/tools/tool-shape";

const KNOWN_HREFS = new Set(Object.keys(TOOL_HREF_AUDIENCES));

const LIVE_TOOL_HREFS = [
  ...LIVE_TOOLS,
  ...LIVE_INTEL_TOOLS,
  CREDIT_COPILOT_TOOL,
  ...RESOURCES_TOOLS,
].map((t) => t.href);

describe("TOOL_SHAPES", () => {
  it("keys every shape to a known registry href", () => {
    for (const href of Object.keys(TOOL_SHAPES)) {
      expect(KNOWN_HREFS.has(href), `${href} should be a registered tool`).toBe(
        true,
      );
    }
  });

  it("gives every live tool a shape with goal/inputs/output", () => {
    for (const href of LIVE_TOOL_HREFS) {
      const shape = getToolShape(href);
      expect(shape, `${href} should have a shape`).toBeDefined();
      expect(shape!.goal.length).toBeGreaterThan(0);
      expect(shape!.inputs.length).toBeGreaterThan(0);
      expect(shape!.output.length).toBeGreaterThan(0);
    }
  });

  it("only points 'next' handoffs at known registry hrefs", () => {
    for (const [href, shape] of Object.entries(TOOL_SHAPES)) {
      for (const next of shape.next) {
        expect(
          KNOWN_HREFS.has(next.href),
          `${href} next -> ${next.href} should be registered`,
        ).toBe(true);
        expect(next.href).not.toBe(href);
      }
    }
  });
});

describe("TOOL_STATUS", () => {
  it("keys every status to a known registry href", () => {
    for (const href of Object.keys(TOOL_STATUS)) {
      expect(KNOWN_HREFS.has(href), `${href} should be registered`).toBe(true);
    }
  });

  it("maps the intel tools to prototype", () => {
    expect(getToolStatus("/tools/borrower-intel")).toBe("prototype");
    expect(getToolStatus("/tools/property-intel")).toBe("prototype");
  });

  it("maps coming-soon placeholders to placeholder", () => {
    expect(getToolStatus("/tools/pricing-comparator")).toBe("placeholder");
  });

  it("defaults unknown hrefs to ready", () => {
    expect(getToolStatus("/tools/does-not-exist")).toBe("ready");
  });

  it("has a label for every status value", () => {
    expect(TOOL_STATUS_LABEL.ready).toBe("Ready");
    expect(TOOL_STATUS_LABEL.prototype).toBe("Prototype");
    expect(TOOL_STATUS_LABEL.placeholder).toBe("Placeholder");
  });
});
