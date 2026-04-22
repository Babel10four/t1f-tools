import type { UnknownRecord } from "../types";

export type PropertyAnalyzeInput = UnknownRecord;

export type PropertyAnalyzeOutput = {
  ok: true;
  engine: "property.analyze";
};

export async function runPropertyAnalyze(
  _input: PropertyAnalyzeInput,
): Promise<PropertyAnalyzeOutput> {
  return { ok: true, engine: "property.analyze" };
}
