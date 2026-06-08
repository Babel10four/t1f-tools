/**
 * Pricing Comparison calculator (Deal Sheet Builder panel).
 *
 * Pure, side-effect-free math comparing a T1F loan against a competitor's pricing/terms.
 * Reproduces the source Google Sheet to the dollar. All math runs on raw (unrounded) numbers;
 * callers round only for display so derived figures (e.g. Pricing Gap) match the sheet.
 *
 * Leverage: each side can specify its leverage as a percent of the purchase price
 * (loan-to-purchase). When set (and a purchase price is provided), it drives that side's
 * acquisition loan amount, so the competitor offering 90% / 95% / 100% of purchase price can be
 * compared against T1F directly. When a side has no leverage set, it falls back to the shared
 * `initialLoanAmount`, preserving the original manual-entry behavior.
 *
 * Loan structures:
 * - "non_dutch" (a "Draw" loan): interest accrues only on funds actually drawn — the acquisition
 *   advance plus the average disbursed portion of the holdback.
 * - "dutch" (a "Term" loan): interest accrues on the full committed loan plus the average
 *   disbursed portion of the holdback.
 */

export type LoanStructure = "non_dutch" | "dutch";

export type PricingComparisonInputs = {
  /** Purchase price, dollars. Enables per-side leverage. 0 = not provided. */
  purchasePrice: number;
  /** Shared acquisition advance used by a side when it has no leverage set, dollars. */
  initialLoanAmount: number;
  /** Holdback (rehab) amount, dollars. Shared across both sides. */
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
  /**
   * Leverage as a percent of the purchase price (e.g. 90 = 90% of purchase price). When non-null
   * and a purchase price is provided, drives this side's acquisition loan amount. `null` falls back
   * to the shared `initialLoanAmount`.
   */
  leveragePercentOfPurchase: number | null;
  /** Annual interest rate as a percent (e.g. 8.5 = 8.500%). */
  ratePercent: number;
  /** Origination points as a percent of the total loan (e.g. 0.5 = 0.500%). */
  originationPointsPercent: number;
  /** Flat admin / loan fee, dollars. */
  adminFees: number;
};

export type SidePricingResult = {
  structure: LoanStructure;
  /** Echo of the leverage used, or null when falling back to the shared acquisition amount. */
  leveragePercentOfPurchase: number | null;
  /** Acquisition advance this side used (leverage-derived or the shared fallback). */
  acquisitionLoanAmount: number;
  /** Acquisition + holdback. */
  totalLoanAmount: number;
  /** Purchase price - acquisition loan; null when no purchase price was provided. */
  borrowerDownPayment: number | null;
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
  purchasePrice: number;
  t1f: SidePricingResult;
  competitor: SidePricingResult;
  /** Competitor total - T1F total. Positive = borrower saves with T1F. */
  pricingGap: number;
  /** Competitor upfront (points + fees) - T1F upfront (points + fees). */
  upfrontSavings: number;
};

function computeSide(
  input: SidePricingInputs,
  purchasePrice: number,
  initialLoanAmount: number,
  holdbackAmount: number,
  avgHoldbackDisbursedFraction: number,
  loanDurationMonths: number,
): SidePricingResult {
  const useLeverage = input.leveragePercentOfPurchase !== null && purchasePrice > 0;
  const acquisitionLoanAmount = useLeverage
    ? purchasePrice * ((input.leveragePercentOfPurchase as number) / 100)
    : initialLoanAmount;
  const totalLoanAmount = acquisitionLoanAmount + holdbackAmount;
  const borrowerDownPayment =
    purchasePrice > 0 ? purchasePrice - acquisitionLoanAmount : null;

  const monthlyRate = input.ratePercent / 100 / 12;
  const avgDisbursedHoldback = holdbackAmount * avgHoldbackDisbursedFraction;
  const interestBase =
    input.structure === "dutch"
      ? totalLoanAmount + avgDisbursedHoldback
      : acquisitionLoanAmount + avgDisbursedHoldback;
  const interest = interestBase * monthlyRate * loanDurationMonths;
  const originationPointsDollars =
    (input.originationPointsPercent / 100) * totalLoanAmount;
  const adminFees = input.adminFees;
  const totalInterestPointsFees = interest + originationPointsDollars + adminFees;
  const revenue = originationPointsDollars + adminFees;
  return {
    structure: input.structure,
    leveragePercentOfPurchase: input.leveragePercentOfPurchase,
    acquisitionLoanAmount,
    totalLoanAmount,
    borrowerDownPayment,
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
  const t1f = computeSide(
    inputs.t1f,
    inputs.purchasePrice,
    inputs.initialLoanAmount,
    inputs.holdbackAmount,
    inputs.avgHoldbackDisbursedFraction,
    inputs.loanDurationMonths,
  );
  const competitor = computeSide(
    inputs.competitor,
    inputs.purchasePrice,
    inputs.initialLoanAmount,
    inputs.holdbackAmount,
    inputs.avgHoldbackDisbursedFraction,
    inputs.loanDurationMonths,
  );

  const pricingGap =
    competitor.totalInterestPointsFees - t1f.totalInterestPointsFees;
  const upfrontSavings =
    competitor.originationPointsDollars +
    competitor.adminFees -
    (t1f.originationPointsDollars + t1f.adminFees);

  return { purchasePrice: inputs.purchasePrice, t1f, competitor, pricingGap, upfrontSavings };
}
