import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runDealAnalyze } from "@/lib/engines/deal/analyze";
import type { DealAnalyzeRequestV1 } from "@/lib/engines/deal/schemas/canonical-request";
import type { DealAnalyzeResponseV1 } from "@/lib/engines/deal/schemas/canonical-response";
import {
  buildDealAnalyzeRequest,
  type LoanAssistantFields,
} from "../loan-structuring-assistant/build-deal-analyze-request";
import { DEFAULT_DEAL_FORM_FIELDS } from "../shared/deal-form-session";
import { TermSheetGeneratorClient } from "./term-sheet-generator-client";

let submitted: DealAnalyzeRequestV1[];
let analyzed: DealAnalyzeResponseV1[];

function useRealEngine() {
  vi.stubGlobal("fetch", vi.fn(async (_url: unknown, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body)) as DealAnalyzeRequestV1;
    submitted.push(request);
    const result = await runDealAnalyze(request);
    analyzed.push(result);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }));
}

function numericInputRequest(overrides: Partial<LoanAssistantFields>): DealAnalyzeRequestV1 {
  const built = buildDealAnalyzeRequest("refinance", {
    ...DEFAULT_DEAL_FORM_FIELDS,
    ...overrides,
  });
  if (!built.ok) throw new Error(built.clientHint);
  return built.request;
}

function startRefinance() {
  render(<TermSheetGeneratorClient />);
  fireEvent.click(screen.getByTestId("ts-flow-refinance"));
  return within(screen.getByTestId("ts-form"));
}

function enter(values: Record<string, string>) {
  const form = within(screen.getByTestId("ts-form"));
  for (const [testId, value] of Object.entries(values)) {
    fireEvent.change(form.getByTestId(testId), { target: { value } });
  }
}

function enterPricing() {
  enter({
    "ts-refi-note-rate": "10",
    "ts-refi-origination-points": "0.5",
    "ts-refi-origination-flat-fee": "1195",
  });
}

async function generateAndAssertParity(previousFields: Partial<LoanAssistantFields>) {
  fireEvent.click(screen.getByTestId("ts-generate-button"));
  await screen.findByTestId("ts-preview");
  expect(submitted).toHaveLength(1);
  const previousRequest = numericInputRequest(previousFields);
  expect(submitted[0]).toEqual(previousRequest);
  expect(analyzed[0]).toEqual(await runDealAnalyze(previousRequest));
  return analyzed[0];
}

beforeEach(() => {
  sessionStorage.clear();
  submitted = [];
  analyzed = [];
  useRealEngine();
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe("refinance form numeric parity", () => {
  it("quotes Jeff's completed property with the same payoff, initial proceeds, and cash gap", async () => {
    const form = startRefinance();
    fireEvent.click(form.getByTestId("ts-refi-borrowing-rehab-no"));
    enter({
      "ts-refi-payoff": "563700",
      "ts-refi-asis": "800000",
      "ts-refi-initial": "560000",
    });
    enterPricing();
    const result = await generateAndAssertParity({
      payoffAmount: "563700",
      asIsValue: "800000",
      requestedLoanAmount: "560000",
      rehabBudget: "0",
      borrowingRehabFunds: "no",
      noteRatePercent: "10",
      originationPointsPercent: "0.5",
      originationFlatFee: "1195",
    });
    expect(result.loan).toMatchObject({
      amount: 560_000,
      acquisitionLoanAmount: 560_000,
      rehabLoanAmount: 0,
      payoffAmount: 563_700,
      aivLtv: 70,
    });
    expect(result.cashToClose.items[0].amount).toBe(3_700);
    expect(result.cashToClose.items[1].amount).toBe(2_800);
    expect(result.cashToClose.items[2].amount).toBe(1_195);
    expect(result.cashToClose.estimatedTotal).toBe(16_095);
    expect(submitted[0].programContext).toBeUndefined();
  });

  it("combines Fleetwood initial funds and full rehab into the same requested total, retaining the cap", async () => {
    startRefinance();
    enter({
      "ts-refi-payoff": "978500",
      "ts-refi-asis": "1350000",
      "ts-refi-arv": "1800000",
      "ts-refi-initial": "877500",
      "ts-refi-rehab": "150000",
    });
    enterPricing();
    const result = await generateAndAssertParity({
      payoffAmount: "978500",
      asIsValue: "1350000",
      arv: "1800000",
      requestedLoanAmount: "1027500",
      rehabBudget: "150000",
      borrowingRehabFunds: "yes",
      noteRatePercent: "10",
      originationPointsPercent: "0.5",
      originationFlatFee: "1195",
    });
    expect(submitted[0].deal.requestedLoanAmount).toBe(1_027_500);
    expect(submitted[0].programContext).toBeUndefined();
    expect(result.loan).toMatchObject({
      amount: 1_012_500,
      acquisitionLoanAmount: 862_500,
      rehabLoanAmount: 150_000,
      payoffAmount: 978_500,
    });
    expect(result.cashToClose.items[0].amount).toBe(116_000);
    expect(result.cashToClose.estimatedTotal).toBe(137_445);
    expect(result.risks.some((risk) => risk.code === "REQUEST_EXCEEDS_POLICY_MAX")).toBe(true);
  });

  it("supports entering a total directly without adding the rehab holdback twice", async () => {
    const form = startRefinance();
    fireEvent.click(form.getByTestId("ts-refi-total-mode"));
    enter({
      "ts-refi-payoff": "978500",
      "ts-refi-asis": "1400000",
      "ts-refi-requested": "1027500",
      "ts-refi-rehab": "150000",
    });
    const result = await generateAndAssertParity({
      payoffAmount: "978500",
      asIsValue: "1400000",
      requestedLoanAmount: "1027500",
      rehabBudget: "150000",
      borrowingRehabFunds: "yes",
    });
    expect(result.loan).toMatchObject({
      amount: 1_027_500,
      acquisitionLoanAmount: 877_500,
      rehabLoanAmount: 150_000,
    });
    expect(result.cashToClose.items[0].amount).toBe(101_000);
  });

  it("preserves a borrower-funded rehab budget with zero financed draws when switching entry modes", async () => {
    const form = startRefinance();
    enter({
      "ts-refi-payoff": "$540,000",
      "ts-refi-asis": "800,000",
      "ts-refi-initial": "$550,000",
      "ts-refi-rehab": "25,000",
    });
    fireEvent.blur(form.getByTestId("ts-refi-initial"));
    fireEvent.click(form.getByTestId("ts-refi-borrower-funded"));
    fireEvent.click(form.getByTestId("ts-refi-total-mode"));
    expect(form.getByTestId("ts-refi-requested")).toHaveValue("550000");
    fireEvent.click(form.getByTestId("ts-refi-split-mode"));
    expect(form.getByTestId("ts-refi-initial")).toHaveValue("550000");
    const result = await generateAndAssertParity({
      payoffAmount: "540000", asIsValue: "800000", rehabBudget: "25000",
      borrowingRehabFunds: "no", requestedLoanAmount: "550000",
    });
    expect(result.loan.rehabLoanAmount).toBe(0);
  });

  it.each(["0", "1"])("keeps Tier %s seasoned refinance explicit and preserves full rehab", async (tier) => {
    const form = startRefinance();
    enter({
      "ts-refi-payoff": "700000",
      "ts-refi-asis": "1000000",
      "ts-refi-arv": "1400000",
      "ts-refi-initial": "700000",
      "ts-refi-rehab": "200000",
    });
    fireEvent.change(form.getByRole("textbox", { name: /Experience tier/i }), { target: { value: tier } });
    fireEvent.click(form.getByTestId("ts-refi-seasoned-scenario"));
    const result = await generateAndAssertParity({
      payoffAmount: "700000",
      asIsValue: "1000000",
      arv: "1400000",
      requestedLoanAmount: "900000",
      rehabBudget: "200000",
      borrowingRehabFunds: "yes",
      experienceTier: tier,
      refinanceScenario: "refinance_seasoned",
    });
    expect(submitted[0].programContext).toEqual({ scenario: "refinance_seasoned" });
    expect(result.loan).toMatchObject({
      amount: 900_000,
      acquisitionLoanAmount: 700_000,
      rehabLoanAmount: 200_000,
      bindingLeg: "arv_ltv_refi",
    });
    expect(result.cashToClose.items[0].amount).toBe(0);
    expect(screen.getByTestId("ts-scenario-basis")).toHaveTextContent("70% ARV");
  });

  it("leaves the explicit seasoned branch when the rep chooses completed work and no future rehab", async () => {
    const form = startRefinance();
    enter({
      "ts-refi-payoff": "700000",
      "ts-refi-asis": "1000000",
      "ts-refi-arv": "1400000",
      "ts-refi-initial": "700000",
      "ts-refi-rehab": "200000",
    });
    fireEvent.change(form.getByRole("textbox", { name: /Experience tier/i }), { target: { value: "1" } });
    fireEvent.click(form.getByTestId("ts-refi-seasoned-scenario"));
    expect(form.getByTestId("ts-refi-seasoned-scenario")).toBeChecked();
    fireEvent.click(form.getByTestId("ts-refi-borrowing-rehab-no"));
    expect(form.queryByTestId("ts-refi-seasoned-scenario")).not.toBeInTheDocument();
    const result = await generateAndAssertParity({
      payoffAmount: "700000",
      asIsValue: "1000000",
      arv: "1400000",
      requestedLoanAmount: "700000",
      rehabBudget: "0",
      borrowingRehabFunds: "no",
      experienceTier: "1",
    });
    expect(submitted[0].programContext).toBeUndefined();
    expect(result.loan.rehabLoanAmount).toBe(0);
    expect(result.loan.acquisitionLoanAmount).toBe(700_000);
  });

  it.each([
    { rehabBudget: 0, borrowingRehabFunds: true },
    { rehabBudget: 200_000, borrowingRehabFunds: false },
  ])("does not silently use generic sizing for an invalid explicit seasoned request: %j", async ({ rehabBudget, borrowingRehabFunds }) => {
    const request = numericInputRequest({
      payoffAmount: "700000",
      requestedLoanAmount: "900000",
      rehabBudget: "200000",
      arv: "1400000",
      asIsValue: "1000000",
      experienceTier: "1",
      borrowingRehabFunds: "yes",
      refinanceScenario: "refinance_seasoned",
    });
    request.deal.rehabBudget = rehabBudget;
    request.assumptions = { ...request.assumptions, borrowingRehabFunds };
    const result = await runDealAnalyze(request);
    expect(result.loan.amount).toBeUndefined();
    expect(result.loan.rehabLoanAmount).toBeUndefined();
    expect(result.pricing.status).toBe("needs_review");
    expect(result.cashToClose.items).toEqual([]);
    expect(result.analysis.flags.some((flag) => flag.code === "SEASONED_REFINANCE_POLICY_UNAVAILABLE")).toBe(true);
  });
});
