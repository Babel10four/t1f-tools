import type {
  BorrowerTier,
  LoanPurpose,
  PropertyType,
} from "./types";

export const LOAN_CALCULATOR_POLICY_VERSION = "2026-06-29";
export const LOAN_CALCULATOR_WORKBOOK_VERSION = "2026-09-14";

export const SUPPORTED_STATES = [
  "CA",
  "WA",
  "TX",
  "FL",
  "CO",
  "SC",
  "IN",
  "MD",
  "NC",
  "IL",
  "VA",
  "GA",
  "OH",
  "TN",
  "MI",
  "MO",
  "PA",
] as const;

export type SupportedState = (typeof SUPPORTED_STATES)[number];

type LeverageRule = {
  purchaseLtc: number;
  purchaseArvLtv: number;
  purchaseNoRehabAsIsLtv: number;
  refinanceRateTermAsIsLtv: number;
  refinanceCashOutAsIsLtv: number;
};

export const LEVERAGE_BY_TIER: Record<BorrowerTier, LeverageRule> = {
  0: {
    purchaseLtc: 0.9,
    purchaseArvLtv: 0.75,
    purchaseNoRehabAsIsLtv: 0.75,
    refinanceRateTermAsIsLtv: 0.7,
    refinanceCashOutAsIsLtv: 0.7,
  },
  1: {
    purchaseLtc: 0.9,
    purchaseArvLtv: 0.75,
    purchaseNoRehabAsIsLtv: 0.75,
    refinanceRateTermAsIsLtv: 0.7,
    refinanceCashOutAsIsLtv: 0.7,
  },
  2: {
    purchaseLtc: 0.9,
    purchaseArvLtv: 0.75,
    purchaseNoRehabAsIsLtv: 0.75,
    refinanceRateTermAsIsLtv: 0.7,
    refinanceCashOutAsIsLtv: 0.7,
  },
  3: {
    purchaseLtc: 0.85,
    purchaseArvLtv: 0.75,
    purchaseNoRehabAsIsLtv: 0.75,
    refinanceRateTermAsIsLtv: 0.65,
    refinanceCashOutAsIsLtv: 0.65,
  },
  4: {
    purchaseLtc: 0.75,
    purchaseArvLtv: 0.7,
    purchaseNoRehabAsIsLtv: 0.7,
    refinanceRateTermAsIsLtv: 0.65,
    refinanceCashOutAsIsLtv: 0.65,
  },
};

/** Spreadsheet rates in percentage points, ordered by its four leverage bands. */
export const BASE_RATE_BY_TIER: Record<
  BorrowerTier,
  readonly [number | null, number | null, number | null, number | null]
> = {
  0: [8.375, 8.375, 8.5, 8.75],
  1: [8.625, 8.75, 8.875, 9],
  2: [8.75, 8.875, 9, 9.125],
  3: [9, 9.25, 9.5, null],
  4: [null, null, null, null],
};

export const MINIMUM_RATE_PERCENT = 8.25;
export const MINIMUM_TOTAL_LOAN = 100_000;
export const SPECIAL_PROGRAM_MINIMUM_INITIAL_LOAN = 125_000;
export const MAX_TOTAL_BORROWER_EXPOSURE = 3_000_000;
export const MAX_MONTHS_OF_SUPPLY = 4.5;
export const MINIMUM_SPECIAL_PROGRAM_FICO = 720;
export const MAX_REHAB_TO_ARV = 0.2;
export const MAX_ASSIGNMENT_FEE_TO_PURCHASE_PRICE = 0.1;

export function isPurchasePurpose(purpose: LoanPurpose): boolean {
  return purpose === "purchase_with_rehab" || purpose === "purchase_no_rehab";
}

export function stateLoanCap(state: string): number {
  if (state === "CA") return 1_500_000;
  if (state === "WA") return 1_250_000;
  return 750_000;
}

export function stateRateAdjustmentPercent(state: string): number {
  if (state === "CA" || state === "WA" || state === "CO") return 0;
  if (state === "TX" || state === "FL") return 0.5;
  return 0.25;
}

export function propertyRateAdjustmentPercent(
  propertyType: PropertyType,
): number {
  return propertyType === "condo_pud" ? 0.25 : 0;
}

export function ficoRateAdjustmentPercent(fico: number): number | null {
  if (fico < 680) return null;
  if (fico < 720) return 0.5;
  if (fico < 760) return 0;
  return -0.25;
}

export function budgetPointsPercent(tier: BorrowerTier): number {
  if (tier <= 1) return 0.4;
  if (tier === 2) return 0.5;
  return 0.6;
}
