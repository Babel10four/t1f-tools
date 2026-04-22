import type { UnknownRecord } from "../types";

export type PropertyValuationInput = UnknownRecord;

export type PropertyValuationOutput = {
  ok: true;
  engine: "property.valuation";
};

export async function runPropertyValuation(
  _input: PropertyValuationInput,
): Promise<PropertyValuationOutput> {
  return { ok: true, engine: "property.valuation" };
}
