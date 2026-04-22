import type { UnknownRecord } from "../types";

export type DealTermsInput = UnknownRecord;

export type DealTermsOutput = {
  ok: true;
  engine: "deal.terms";
};

export async function runDealTerms(
  _input: DealTermsInput,
): Promise<DealTermsOutput> {
  return { ok: true, engine: "deal.terms" };
}
