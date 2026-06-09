/**
 * Hub "Workflows" recipes: ordered jump-orders across standalone tools.
 *
 * These never change any tool's UI or behavior — they are pure navigation hints that suggest a
 * sensible sequence. Steps are role-filtered via {@link hrefVisibleToRole} so users never see a
 * recipe pointing at an admin-only tool, and empty recipes drop out entirely.
 */

import type { AuthRole } from "@/lib/auth/constants";
import { hrefVisibleToRole } from "@/lib/tools/tool-visibility";

export type WorkflowStep = { href: string; label: string };

export type Workflow = {
  id: string;
  title: string;
  description: string;
  steps: WorkflowStep[];
};

export const WORKFLOWS: Workflow[] = [
  {
    id: "prospecting",
    title: "Prospecting",
    description: "Reach out, learn the borrower, and frame a deal.",
    steps: [
      { href: "/tools/email-templates", label: "Email Templates" },
      { href: "/tools/borrower-intel", label: "Borrower Intel" },
      { href: "/tools/term-sheet", label: "Deal Sheet Builder" },
    ],
  },
  {
    id: "eligibility-terms",
    title: "Eligibility + Terms",
    description: "Screen the property, then shape and price terms.",
    steps: [
      { href: "/tools/rural-checker", label: "Rural Eligibility Checker" },
      { href: "/tools/term-sheet", label: "Deal Sheet Builder" },
      { href: "/tools/cash-to-close-estimator", label: "Cash to Close Calculator" },
    ],
  },
  {
    id: "research-deal",
    title: "Research a deal",
    description: "Gather property and borrower context before quoting.",
    steps: [
      { href: "/tools/property-intel", label: "Property Intel" },
      { href: "/tools/borrower-intel", label: "Borrower Intel" },
      { href: "/tools/term-sheet", label: "Deal Sheet Builder" },
    ],
  },
];

/** Role-filtered recipes: drops steps the role can't see, then drops recipes left with < 2 steps. */
export function workflowsForRole(role: AuthRole): Workflow[] {
  return WORKFLOWS.map((workflow) => ({
    ...workflow,
    steps: workflow.steps.filter((step) => hrefVisibleToRole(step.href, role)),
  })).filter((workflow) => workflow.steps.length >= 2);
}
