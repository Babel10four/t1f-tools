/**
 * Modular UX framework: the standardized "shape" of every tool page.
 *
 * Each live tool declares a one-sentence Goal, the Inputs it needs, the Output it produces, and
 * optional Next handoffs (just links — never wizard steps). {@link ToolPageHeader} renders this so
 * every tool feels part of one cohesive set while staying fully standalone.
 *
 * Keep this module pure (no React) so it can be unit-tested and imported anywhere.
 */

export type ToolStatus = "ready" | "prototype" | "placeholder";

export type ToolHandoff = { href: string; label: string };

export type ToolShape = {
  /** What the tool does, in one sentence. */
  goal: string;
  /** Exactly what the user must supply. */
  inputs: string[];
  /** What the user gets back. */
  output: string;
  /** Optional suggested handoffs — links only, role-filtered at render time. */
  next: ToolHandoff[];
};

/**
 * Production-readiness badge per tool. Live tools are `ready`; the Firecrawl/GPT intel tools are
 * `prototype` (they degrade gracefully when API keys are absent); coming-soon stubs are `placeholder`.
 */
export const TOOL_STATUS: Record<string, ToolStatus> = {
  "/tools/loan-structuring-assistant": "ready",
  "/tools/term-sheet": "ready",
  "/tools/cash-to-close-estimator": "ready",
  "/tools/pricing-calculator": "ready",
  "/tools/rural-checker": "ready",
  "/tools/credit-copilot": "ready",
  "/tools/email-templates": "ready",
  "/tools/deal-analyzer": "ready",
  "/tools/borrower-intel": "prototype",
  "/tools/property-intel": "prototype",
  // Coming-soon placeholders
  "/tools/pricing-comparator": "placeholder",
  "/tools/disclosure-builder": "placeholder",
  "/tools/market-analyzer": "placeholder",
  "/tools/prospect-researcher": "placeholder",
  "/tools/voice-agent": "placeholder",
};

export function getToolStatus(href: string): ToolStatus {
  return TOOL_STATUS[href] ?? "ready";
}

export const TOOL_STATUS_LABEL: Record<ToolStatus, string> = {
  ready: "Ready",
  prototype: "Prototype",
  placeholder: "Placeholder",
};

export const TOOL_SHAPES: Record<string, ToolShape> = {
  "/tools/loan-structuring-assistant": {
    goal: "Structure a bridge purchase or refinance with full deal analysis.",
    inputs: [
      "Deal flow (purchase or refinance) and amounts",
      "Rehab budget and ARV",
      "Borrower FICO and experience tier",
    ],
    output:
      "Loan structure, pricing readiness, cash-to-close, and risk flags from the deal engine.",
    next: [
      { href: "/tools/term-sheet", label: "Deal Sheet Builder" },
      { href: "/tools/cash-to-close-estimator", label: "Cash to Close Calculator" },
    ],
  },
  "/tools/term-sheet": {
    goal: "Turn deal inputs into an indicative, non-binding term sheet you can export.",
    inputs: [
      "Purchase or refinance amounts",
      "Rehab budget and ARV",
      "Term, closing date, note rate (optional)",
    ],
    output:
      "Branded term-sheet preview with cash-to-close, copyable text, and PDF download.",
    next: [
      { href: "/tools/cash-to-close-estimator", label: "Cash to Close Calculator" },
      { href: "/tools/email-templates", label: "Email Templates" },
      { href: "/tools/credit-copilot", label: "Credit Copilot" },
    ],
  },
  "/tools/cash-to-close-estimator": {
    goal: "Estimate the cash a borrower needs at closing, line by line.",
    inputs: [
      "Purchase/refi amounts, rehab, and term",
      "Note rate (optional)",
      "Closing date",
    ],
    output:
      "Cash-to-close line items, interest estimate, and a client-ready summary.",
    next: [
      { href: "/tools/term-sheet", label: "Deal Sheet Builder" },
      { href: "/tools/email-templates", label: "Email Templates" },
    ],
  },
  "/tools/pricing-calculator": {
    goal: "Check rate readiness and pricing context from the deal engine.",
    inputs: ["Deal amounts and term", "Borrower profile"],
    output: "Pricing-first view: note rate, margin, and policy context.",
    next: [
      { href: "/tools/term-sheet", label: "Deal Sheet Builder" },
      { href: "/tools/loan-structuring-assistant", label: "Deal Structuring Copilot" },
    ],
  },
  "/tools/rural-checker": {
    goal: "Screen a U.S. address for rural eligibility with a criterion-by-criterion evidence report.",
    inputs: ["Property street address (or city/state)"],
    output:
      "Rural outcome (Likely Rural / Not Rural / Manual UW) with an evidence matrix and policy score.",
    next: [
      { href: "/tools/term-sheet", label: "Deal Sheet Builder" },
      { href: "/tools/property-intel", label: "Property Intel" },
    ],
  },
  "/tools/credit-copilot": {
    goal: "Ask questions about the published credit policy and get grounded, cited answers.",
    inputs: ["A policy question in plain English"],
    output:
      "An answer with citations to the published policy text — not an underwriting decision.",
    next: [
      { href: "/tools/term-sheet", label: "Deal Sheet Builder" },
      { href: "/tools/rural-checker", label: "Rural Eligibility Checker" },
    ],
  },
  "/tools/borrower-intel": {
    goal: "Assemble a structured Borrower Snapshot from public web sources.",
    inputs: [
      "Borrower name (required)",
      "Entity name and website (optional)",
    ],
    output:
      "Borrower Snapshot: experience, primary markets, likely buy box, risk flags, and confidence.",
    next: [
      { href: "/tools/property-intel", label: "Property Intel" },
      { href: "/tools/term-sheet", label: "Deal Sheet Builder" },
    ],
  },
  "/tools/property-intel": {
    goal: "Build a Property Dossier from public listing and records sources.",
    inputs: ["Property address (required)"],
    output:
      "Dossier: listing and price history, prior sales, tax history, and market/neighborhood notes.",
    next: [
      { href: "/tools/borrower-intel", label: "Borrower Intel" },
      { href: "/tools/term-sheet", label: "Deal Sheet Builder" },
    ],
  },
  "/tools/email-templates": {
    goal: "Grab a ready-to-send email draft for any stage of a deal.",
    inputs: ["Pick a template and personalize the {{merge fields}}"],
    output: "Copyable subject and body with detected merge fields to fill in.",
    next: [
      { href: "/tools/borrower-intel", label: "Borrower Intel" },
      { href: "/tools/term-sheet", label: "Deal Sheet Builder" },
    ],
  },
  "/tools/deal-analyzer": {
    goal: "Send raw JSON to the deal analyze API for contract checks.",
    inputs: ["A DealAnalyzeRequest JSON payload"],
    output: "The raw analyze response for inspection.",
    next: [{ href: "/tools/term-sheet", label: "Deal Sheet Builder" }],
  },
};

export function getToolShape(href: string): ToolShape | undefined {
  return TOOL_SHAPES[href];
}
