import { describe, expect, it } from "vitest";
import { TOOL_HREF_AUDIENCES } from "@/lib/tools/tool-visibility";
import { WORKFLOWS, workflowsForRole } from "@/lib/tools/workflows";

const KNOWN_HREFS = new Set(Object.keys(TOOL_HREF_AUDIENCES));

describe("WORKFLOWS", () => {
  it("references only known registry hrefs", () => {
    for (const workflow of WORKFLOWS) {
      for (const step of workflow.steps) {
        expect(
          KNOWN_HREFS.has(step.href),
          `${workflow.id} -> ${step.href} should be registered`,
        ).toBe(true);
      }
    }
  });

  it("has unique workflow ids", () => {
    const ids = WORKFLOWS.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("workflowsForRole", () => {
  it("returns every recipe for admin", () => {
    expect(workflowsForRole("admin")).toHaveLength(WORKFLOWS.length);
  });

  it("drops admin-only steps for users", () => {
    const eligibility = workflowsForRole("user").find(
      (w) => w.id === "eligibility-terms",
    );
    expect(eligibility).toBeDefined();
    const hrefs = eligibility!.steps.map((s) => s.href);
    // Cash to Close is admin-only and should be filtered out for users.
    expect(hrefs).not.toContain("/tools/cash-to-close-estimator");
    expect(hrefs).toContain("/tools/term-sheet");
  });

  it("never surfaces a recipe with fewer than two steps", () => {
    for (const workflow of workflowsForRole("user")) {
      expect(workflow.steps.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("only includes user-visible steps for users", () => {
    for (const workflow of workflowsForRole("user")) {
      for (const step of workflow.steps) {
        expect(TOOL_HREF_AUDIENCES[step.href]).toContain("user");
      }
    }
  });
});
