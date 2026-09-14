import {
  BASE_RATE_BY_TIER,
  budgetPointsPercent,
  ficoRateAdjustmentPercent,
  isPurchasePurpose,
  LEVERAGE_BY_TIER,
  LOAN_CALCULATOR_POLICY_VERSION,
  MAX_ASSIGNMENT_FEE_TO_PURCHASE_PRICE,
  MAX_MONTHS_OF_SUPPLY,
  MAX_REHAB_TO_ARV,
  MAX_TOTAL_BORROWER_EXPOSURE,
  MINIMUM_RATE_PERCENT,
  MINIMUM_SPECIAL_PROGRAM_FICO,
  MINIMUM_TOTAL_LOAN,
  propertyRateAdjustmentPercent,
  SPECIAL_PROGRAM_MINIMUM_INITIAL_LOAN,
  stateLoanCap,
  stateRateAdjustmentPercent,
  SUPPORTED_STATES,
} from "./rules";
import type {
  EligibilityCheck,
  LoanCalculatorInput,
  LoanCalculatorResult,
  ValidationIssue,
} from "./types";

function roundDown(value: number, increment: number): number {
  return Math.trunc(value / increment) * increment;
}

function roundToIncrement(value: number, increment: number): number {
  return Math.round((value + Number.EPSILON) / increment) * increment;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(2).replace(/\.00$/, "")}%`;
}

function money(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function yesNoEligibility(checks: EligibilityCheck[]) {
  return { eligible: checks.every((check) => check.passed), checks };
}

function baseRateBandForPurchase(
  actualInitialLtc: number,
  actualArvLtv: number,
): number {
  if (actualInitialLtc <= 0.75 && actualArvLtv <= 0.7) return 0;
  if (actualInitialLtc <= 0.8 && actualArvLtv <= 0.7) return 1;
  if (actualInitialLtc <= 0.85 && actualArvLtv <= 0.75) return 2;
  return 3;
}

function baseRateBandForRefinance(actualAsIsLtv: number): number {
  if (actualAsIsLtv <= 0.7) return 0;
  // The workbook repeats 70% for the second band, making it unreachable.
  if (actualAsIsLtv <= 0.7) return 1;
  if (actualAsIsLtv <= 0.75) return 2;
  return 3;
}

function finiteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

export function validateLoanCalculatorInput(
  input: LoanCalculatorInput,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const purchase = isPurchasePurpose(input.purpose);

  if (!SUPPORTED_STATES.includes(input.state as (typeof SUPPORTED_STATES)[number])) {
    issues.push({ field: "state", message: "Choose a supported property state." });
  }
  if (!Number.isInteger(input.borrowerTier) || input.borrowerTier < 0 || input.borrowerTier > 4) {
    issues.push({ field: "borrowerTier", message: "Borrower tier must be 0 through 4." });
  }
  if (!Number.isFinite(input.fico) || input.fico < 300 || input.fico > 850) {
    issues.push({ field: "fico", message: "Enter a FICO score between 300 and 850." });
  }
  if (!finiteNonNegative(input.flipsCompletedWithT1f)) {
    issues.push({ field: "flipsCompletedWithT1f", message: "Completed flips cannot be negative." });
  }
  if (!finiteNonNegative(input.constructionAdvanceExposure)) {
    issues.push({
      field: "constructionAdvanceExposure",
      message: "Construction-advance exposure cannot be negative.",
    });
  }
  if (!finiteNonNegative(input.virtualInspectionExposure)) {
    issues.push({
      field: "virtualInspectionExposure",
      message: "Virtual-inspection exposure cannot be negative.",
    });
  }
  if (!input.city || !Number.isFinite(input.monthsOfSupply)) {
    issues.push({ field: "city", message: "Select an eligible city from the market data list." });
  }

  for (const field of [
    "assignmentFees",
    "sellerConcessions",
    "documentedImprovements",
    "rehabBudget",
    "rehabHoldback",
  ] as const) {
    if (!finiteNonNegative(input[field])) {
      issues.push({ field, message: "Enter zero or a positive amount." });
    }
  }

  if (purchase) {
    if (!(input.purchasePrice > 0)) {
      issues.push({ field: "purchasePrice", message: "Enter a purchase price greater than zero." });
    }
    if (!(input.arv > 0)) {
      issues.push({ field: "arv", message: "Enter an after-repair value greater than zero." });
    }
  } else if (!(input.asIsValue > 0)) {
    issues.push({ field: "asIsValue", message: "Enter an as-is value greater than zero." });
  }

  if (input.purpose === "purchase_with_rehab") {
    if (!(input.rehabBudget > 0)) {
      issues.push({ field: "rehabBudget", message: "Purchase with rehab requires a rehab budget." });
    }
    if (!(input.rehabHoldback > 0)) {
      issues.push({ field: "rehabHoldback", message: "Purchase with rehab requires a financed holdback." });
    } else if (input.rehabHoldback !== input.rehabBudget) {
      issues.push({ field: "rehabHoldback", message: "The financed holdback must match the rehab budget." });
    }
  } else if (input.rehabBudget !== 0 || input.rehabHoldback !== 0) {
    issues.push({
      field: "rehabBudget",
      message: "Only Purchase — With Rehab can include a rehab budget or holdback.",
    });
  }

  if (
    input.requestedLtc !== undefined &&
    (!Number.isFinite(input.requestedLtc) || input.requestedLtc <= 0 || input.requestedLtc > 1)
  ) {
    issues.push({ field: "requestedLtc", message: "Requested LTC must be between 0% and 100%." });
  }
  if (
    input.requestedPoints !== undefined &&
    (!Number.isFinite(input.requestedPoints) || input.requestedPoints < 0)
  ) {
    issues.push({ field: "requestedPoints", message: "Requested points cannot be negative." });
  }

  return issues;
}

export function calculateLoanCalculator(
  input: LoanCalculatorInput,
): LoanCalculatorResult {
  const purchase = isPurchasePurpose(input.purpose);
  const leverage = LEVERAGE_BY_TIER[input.borrowerTier];
  const holdback = input.rehabHoldback || 0;
  const costBasis =
    input.purchasePrice +
    input.assignmentFees -
    input.sellerConcessions +
    input.documentedImprovements;

  const maxLtc = purchase ? leverage.purchaseLtc : null;
  const maxInitialLoanByLtc = maxLtc === null ? null : maxLtc * costBasis;
  const maxArvLtv = purchase ? leverage.purchaseArvLtv : null;
  const maxTotalLoanByArv = maxArvLtv === null ? null : input.arv * maxArvLtv;
  const maxAsIsLtv = purchase
    ? null
    : input.purpose === "refinance_rate_term"
      ? leverage.refinanceRateTermAsIsLtv
      : leverage.refinanceCashOutAsIsLtv;
  const maxLoanByAsIsValue =
    maxAsIsLtv === null ? null : input.asIsValue * maxAsIsLtv + holdback;
  const requestedTotalLoan =
    input.requestedLtc === undefined
      ? null
      : input.requestedLtc * costBasis + holdback;

  let calculatedTotalLoan: number;
  if (purchase) {
    const spreadsheetCap =
      requestedTotalLoan === null
        ? Math.min(maxTotalLoanByArv ?? 0, (maxInitialLoanByLtc ?? 0) + holdback)
        : Math.min(requestedTotalLoan, (maxInitialLoanByLtc ?? 0) + holdback);
    calculatedTotalLoan = roundDown(spreadsheetCap, 100);
  } else {
    const spreadsheetCap =
      requestedTotalLoan === null
        ? (maxLoanByAsIsValue ?? 0)
        : Math.min(requestedTotalLoan, maxLoanByAsIsValue ?? 0);
    calculatedTotalLoan = roundDown(spreadsheetCap, 100);
  }

  let initialLoanAmount: number;
  if (purchase) {
    const initialCaps = [
      maxInitialLoanByLtc ?? 0,
      (maxTotalLoanByArv ?? 0) - holdback,
    ];
    if (requestedTotalLoan !== null) initialCaps.push(requestedTotalLoan - holdback);
    initialLoanAmount = roundDown(Math.min(...initialCaps), 100);
  } else {
    initialLoanAmount = roundDown(calculatedTotalLoan - holdback, 1);
  }

  const fundedTotalLoanAmount = initialLoanAmount + holdback;
  const downPaymentRequired = purchase
    ? input.purchasePrice + input.assignmentFees - input.sellerConcessions - initialLoanAmount
    : null;
  const actualInitialLtc = purchase && costBasis > 0 ? initialLoanAmount / costBasis : null;
  const actualArvLtv = purchase && input.arv > 0 ? fundedTotalLoanAmount / input.arv : null;
  const actualAsIsLtv = !purchase && input.asIsValue > 0 ? initialLoanAmount / input.asIsValue : null;

  const rateBand = purchase
    ? baseRateBandForPurchase(actualInitialLtc ?? 0, actualArvLtv ?? 0)
    : baseRateBandForRefinance(actualAsIsLtv ?? 0);
  const gridRate = BASE_RATE_BY_TIER[input.borrowerTier][rateBand];
  const ficoAdjustment = ficoRateAdjustmentPercent(input.fico);
  const loanSizeAdjustment = calculatedTotalLoan < 150_000 ? 0.25 : 0;
  const refinanceAdjustment = purchase ? 0 : 1.25;
  const borrowerRatePercent =
    gridRate === null || ficoAdjustment === null
      ? null
      : gridRate +
        refinanceAdjustment +
        stateRateAdjustmentPercent(input.state) +
        propertyRateAdjustmentPercent(input.propertyType) +
        loanSizeAdjustment +
        ficoAdjustment;

  const budgetPoints = budgetPointsPercent(input.borrowerTier);
  const adjustedPointsPercent =
    calculatedTotalLoan > 0
      ? roundToIncrement(
          (budgetPoints / 100 / (calculatedTotalLoan / 525_000)) * 100,
          0.125,
        )
      : 0;
  const revisedRatePercent =
    input.requestedPoints === undefined || borrowerRatePercent === null
      ? null
      : borrowerRatePercent +
        2 * (adjustedPointsPercent - input.requestedPoints * 100);

  const cap = stateLoanCap(input.state);
  const rehabArvLimit = MAX_REHAB_TO_ARV * input.arv;
  const assignmentLimit = MAX_ASSIGNMENT_FEE_TO_PURCHASE_PRICE * input.purchasePrice;
  const maxInitialConstructionDraw = purchase
    ? Math.max(
        0,
        Math.min(holdback * 0.3, 25_000, input.purchasePrice - initialLoanAmount),
      )
    : 0;
  const initialPlusFirstAdvanceLtc =
    purchase && input.purchasePrice > 0
      ? (initialLoanAmount + maxInitialConstructionDraw) / input.purchasePrice
      : null;

  const commonChecks: EligibilityCheck[] = [
    {
      key: "fico",
      label: "Guarantor FICO",
      actual: String(input.fico),
      requirement: `${MINIMUM_SPECIAL_PROGRAM_FICO}+`,
      passed: input.fico >= MINIMUM_SPECIAL_PROGRAM_FICO,
    },
    {
      key: "minimum_initial_loan",
      label: "Minimum initial loan",
      actual: money(initialLoanAmount),
      requirement: `${money(SPECIAL_PROGRAM_MINIMUM_INITIAL_LOAN)}+`,
      passed: initialLoanAmount >= SPECIAL_PROGRAM_MINIMUM_INITIAL_LOAN,
    },
    {
      key: "maximum_initial_loan",
      label: "Maximum initial loan",
      actual: money(initialLoanAmount),
      requirement: `${money(cap)} or less`,
      passed: initialLoanAmount <= cap,
    },
    {
      key: "rehab_limit",
      label: "Rehab budget",
      actual: money(input.rehabBudget),
      requirement: `${money(rehabArvLimit)} or less (20% of ARV)`,
      passed: input.rehabBudget <= rehabArvLimit,
    },
    {
      key: "assignment_fees",
      label: "Assignment fees",
      actual: money(input.assignmentFees),
      requirement: `${money(assignmentLimit)} or less (10% of purchase price)`,
      passed: input.assignmentFees <= assignmentLimit,
    },
    {
      key: "months_of_supply",
      label: "Months of supply",
      actual: input.monthsOfSupply.toFixed(1),
      requirement: `${MAX_MONTHS_OF_SUPPLY.toFixed(1)} or less`,
      passed: input.monthsOfSupply <= MAX_MONTHS_OF_SUPPLY,
    },
  ];

  const constructionAdvance = yesNoEligibility([
    {
      key: "borrower_tier",
      label: "Borrower tier",
      actual: `Tier ${input.borrowerTier}`,
      requirement: "Tier 0, 1, or 2",
      passed: input.borrowerTier < 3,
    },
    {
      key: "construction_advance_exposure",
      label: "Borrower exposure — construction advances",
      actual: money(input.constructionAdvanceExposure),
      requirement: `${money(MAX_TOTAL_BORROWER_EXPOSURE)} or less`,
      passed: input.constructionAdvanceExposure <= MAX_TOTAL_BORROWER_EXPOSURE,
    },
    ...commonChecks,
  ]);

  const virtualInspection = yesNoEligibility([
    {
      key: "borrower_tier",
      label: "Borrower tier",
      actual: `Tier ${input.borrowerTier}`,
      requirement: "Tier 0 or 1",
      passed: input.borrowerTier < 2,
    },
    {
      key: "completed_flips",
      label: "T1F completed flips",
      actual: String(input.flipsCompletedWithT1f),
      requirement: "3 or more",
      passed: input.flipsCompletedWithT1f >= 3,
    },
    {
      key: "virtual_inspection_exposure",
      label: "Borrower exposure — virtual inspections",
      actual: money(input.virtualInspectionExposure),
      requirement: `${money(MAX_TOTAL_BORROWER_EXPOSURE)} or less`,
      passed: input.virtualInspectionExposure <= MAX_TOTAL_BORROWER_EXPOSURE,
    },
    ...commonChecks,
    {
      key: "property_type",
      label: "Property type",
      actual:
        input.propertyType === "sfr"
          ? "SFR"
          : input.propertyType === "condo_pud"
            ? "Condo/PUD"
            : "2–4 units",
      requirement: "SFR",
      passed: input.propertyType === "sfr",
    },
  ]);

  const warnings: string[] = [];
  if (calculatedTotalLoan < MINIMUM_TOTAL_LOAN) {
    warnings.push("Total loan amount is below the $100,000 minimum.");
  }
  if (borrowerRatePercent === null) {
    warnings.push("Pricing exception required for this tier, leverage, or FICO combination.");
  } else if (borrowerRatePercent < MINIMUM_RATE_PERCENT) {
    warnings.push("Calculated rate is below the required 8.25% minimum.");
  }
  if (input.requestedPoints !== undefined && input.requestedPoints < 0.0025) {
    warnings.push("Requested borrower points are below the 0.25% minimum.");
  }
  if (revisedRatePercent !== null && revisedRatePercent < MINIMUM_RATE_PERCENT) {
    warnings.push("Revised rate is below the required 8.25% minimum.");
  }
  if (
    purchase &&
    input.sellerConcessions > input.purchasePrice * 0.02
  ) {
    warnings.push("Seller concessions exceed 2% of the purchase price.");
  }

  return {
    policyVersion: LOAN_CALCULATOR_POLICY_VERSION,
    costBasis,
    maxLtc,
    maxInitialLoanByLtc,
    maxArvLtv,
    maxTotalLoanByArv,
    maxAsIsLtv,
    maxLoanByAsIsValue,
    requestedTotalLoan,
    calculatedTotalLoan,
    initialLoanAmount,
    rehabHoldbackLoanAmount: holdback,
    fundedTotalLoanAmount,
    downPaymentRequired,
    actualInitialLtc,
    actualArvLtv,
    actualAsIsLtv,
    borrowerRatePercent,
    budgetPointsPercent: budgetPoints,
    adjustedPointsPercent,
    revisedRatePercent,
    maxInitialConstructionDraw,
    initialPlusFirstAdvanceLtc,
    constructionAdvance,
    virtualInspection,
    warnings,
  };
}

export const loanCalculatorFormatting = { money, percent };
