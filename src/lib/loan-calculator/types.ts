export const LOAN_PURPOSES = [
  "purchase_with_rehab",
  "purchase_no_rehab",
  "refinance_rate_term",
  "refinance_cash_out",
] as const;

export type LoanPurpose = (typeof LOAN_PURPOSES)[number];

export const PROPERTY_TYPES = ["sfr", "condo_pud", "two_to_four"] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number];

export type BorrowerTier = 0 | 1 | 2 | 3 | 4;

export type LoanCalculatorInput = {
  state: string;
  borrowerTier: BorrowerTier;
  flipsCompletedWithT1f: number;
  fico: number;
  purpose: LoanPurpose;
  propertyType: PropertyType;
  constructionAdvanceExposure: number;
  virtualInspectionExposure: number;
  city: string;
  monthsOfSupply: number;
  purchasePrice: number;
  assignmentFees: number;
  sellerConcessions: number;
  documentedImprovements: number;
  rehabBudget: number;
  rehabHoldback: number;
  arv: number;
  asIsValue: number;
  /** Decimal ratio, e.g. 0.85 for 85%. */
  requestedLtc?: number;
  /** Decimal ratio, e.g. 0.01 for 1%. */
  requestedPoints?: number;
};

export type EligibilityCheck = {
  key: string;
  label: string;
  actual: string;
  requirement: string;
  passed: boolean;
};

export type EligibilityResult = {
  eligible: boolean;
  checks: EligibilityCheck[];
};

export type LoanCalculatorResult = {
  policyVersion: string;
  costBasis: number;
  maxLtc: number | null;
  maxInitialLoanByLtc: number | null;
  maxArvLtv: number | null;
  maxTotalLoanByArv: number | null;
  maxAsIsLtv: number | null;
  maxLoanByAsIsValue: number | null;
  requestedTotalLoan: number | null;
  calculatedTotalLoan: number;
  initialLoanAmount: number;
  rehabHoldbackLoanAmount: number;
  fundedTotalLoanAmount: number;
  downPaymentRequired: number | null;
  actualInitialLtc: number | null;
  actualArvLtv: number | null;
  actualAsIsLtv: number | null;
  borrowerRatePercent: number | null;
  budgetPointsPercent: number;
  adjustedPointsPercent: number;
  revisedRatePercent: number | null;
  maxInitialConstructionDraw: number;
  initialPlusFirstAdvanceLtc: number | null;
  constructionAdvance: EligibilityResult;
  virtualInspection: EligibilityResult;
  warnings: string[];
};

export type ValidationIssue = {
  field: keyof LoanCalculatorInput | "form";
  message: string;
};
