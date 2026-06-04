/**
 * Pricing Comparison calculator (Deal Sheet Builder panel).
 *
 * Pure, side-effect-free math comparing a T1F loan against a competitor's pricing/terms.
 * Reproduces the source Google Sheet to the dollar. All math runs on raw (unrounded) numbers;
 * callers round only for display so derived figures (e.g. Pricing Gap) match the sheet.
 *
 * Loan structures:
 * - "non_dutch" (a "Draw" loan): interest accrues only on funds actually drawn — the initial
 *   advance plus the average disbursed portion of the holdback.
 * - "dutch" (a "Term" loan): interest accrues on the full committed loan plus the average
 *   disbursed portion of the holdback.
 */

export type LoanStructure = "non_dutch" | "dutch";

export type PricingComparisonInputs = {
  /** Initial (acquisition) advance, dollars. */
  initialLoanAmount: number;
  /** Holdback (rehab) amount, dollars. */
  holdbackAmount: number;
  /** Average fraction of the holdback disbursed across the term (0-1, e.g. 0.5 = 50%). */
  avgHoldbackDisbursedFraction: number;
  /** Loan duration in months. */
  loanDurationMonths: number;
  t1f: SidePricingInputs;
  competitor: SidePricingInputs;
};

export type SidePricingInputs = {
  structure: LoanStructure;
  /** Annual interest rate as a percent (e.g. 8.5 = 8.500%). */
  ratePercent: number;
  /** Origination points as a percent of the total loan (e.g. 0.5 = 0.500%). */
  originationPointsPercent: number;
  /** Flat admin / loan fee, dollars. */
  adminFees: number;
};

export type SidePricingResult = {
  structure: LoanStructure;
  /** Principal the interest is computed on. */
  interestBase: number;
  interest: number;
  /** Origination points expressed in dollars. */
  originationPointsDollars: number;
  adminFees: number;
  /** Interest + points + fees. */
  totalInterestPointsFees: number;
  /** Lender revenue = points + fees (interest is cost of capital, excluded). */
  revenue: number;
  /** Adjusted total interest, points & fees (equals total until an adjustment is defined). */
  adjustedTotalInterestPointsFees: number;
};

export type PricingComparisonResult = {
  totalLoanAmount: number;
  t1f: SidePricingResult;
  competitor: SidePricingResult;
  /** Competitor total - T1F total. Positive = borrower saves with T1F. */
  pricingGap: number;
  /** Competitor upfront (points + fees) - T1F upfront (points + fees). */
  upfrontSavings: number;
};

function computeSide(
  input: SidePricingInputs,
  initialLoanAmount: number,
  holdbackAmount: number,
  totalLoanAmount: number,
  avgHoldbackDisbursedFraction: number,
  loanDurationMonths: number,
): SidePricingResult {
  const monthlyRate = input.ratePercent / 100 / 12;
  const avgDisbursedHoldback = holdbackAmount * avgHoldbackDisbursedFraction;
  const interestBase =
    input.structure === "dutch"
      ? totalLoanAmount + avgDisbursedHoldback
      : initialLoanAmount + avgDisbursedHoldback;
  const interest = interestBase * monthlyRate * loanDurationMonths;
  const originationPointsDollars =
    (input.originationPointsPercent / 100) * totalLoanAmount;
  const adminFees = input.adminFees;
  const totalInterestPointsFees = interest + originationPointsDollars + adminFees;
  const revenue = originationPointsDollars + adminFees;
  return {
    structure: input.structure,
    interestBase,
    interest,
    originationPointsDollars,
    adminFees,
    totalInterestPointsFees,
    revenue,
    adjustedTotalInterestPointsFees: totalInterestPointsFees,
  };
}

export function computePricingComparison(
  inputs: PricingComparisonInputs,
): PricingComparisonResult {
  const totalLoanAmount = inputs.initialLoanAmount + inputs.holdbackAmount;

  const t1f = computeSide(
    inputs.t1f,
    inputs.initialLoanAmount,
    inputs.holdbackAmount,
    totalLoanAmount,
    inputs.avgHoldbackDisbursedFraction,
    inputs.loanDurationMonths,
  );
  const competitor = computeSide(
    inputs.competitor,
    inputs.initialLoanAmount,
    inputs.holdbackAmount,
    totalLoanAmount,
    inputs.avgHoldbackDisbursedFraction,
    inputs.loanDurationMonths,
  );

  const pricingGap =
    competitor.totalInterestPointsFees - t1f.totalInterestPointsFees;
  const upfrontSavings =
    competitor.originationPointsDollars +
    competitor.adminFees -
    (t1f.originationPointsDollars + t1f.adminFees);

  return { totalLoanAmount, t1f, competitor, pricingGap, upfrontSavings };
}
