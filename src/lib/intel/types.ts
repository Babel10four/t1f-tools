/**
 * Intelligence Layer — shared persisted shapes (Initiative 1).
 *
 * These types describe the JSONB payloads stored in the `intel_*` tables (see
 * `src/db/schema.ts`) and returned by the intel engines. Kept in `src/lib/intel` so the
 * Drizzle schema, engines, and UI can all import a single source of truth.
 */

export type IntelConfidence = "low" | "medium" | "high";

/** Where a snapshot's facts came from (for provenance / "store sources" requirement). */
export type IntelSource = {
  url: string;
  title?: string;
  kind: "website" | "linkedin" | "search" | "public_profile";
};

/** Borrower Snapshot — the GPT-summarized intelligence for a borrower/entity. */
export type BorrowerSnapshot = {
  summary: string;
  experience: {
    /** Estimated number of completed flips, when inferable. */
    estimatedFlips: number | null;
    note: string;
  };
  primaryMarkets: string[];
  likelyBuyBox: {
    low: number | null;
    high: number | null;
    note: string;
  };
  riskFlags: string[];
  exitStrategyPatterns: string[];
  confidence: IntelConfidence;
};

/** Property Dossier — assembled from listing/records sources (scaffold for follow-up). */
export type PropertyDossier = {
  listingHistory: string[];
  priceChanges: string[];
  priorSales: string[];
  taxHistory: string[];
  marketNotes: string;
  neighborhoodNotes: string;
  confidence: IntelConfidence;
};

/** Competitor parsed program facts (scaffold for the nightly agent). */
export type CompetitorParsed = {
  ltv: string | null;
  rates: string | null;
  states: string[];
  programs: string[];
  fees: string | null;
};
