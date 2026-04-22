import type { UnknownRecord } from "../types";

export type DealStructureInput = UnknownRecord;

export type DealStructureOutput = {
  ok: true;
  engine: "deal.structure";
};

export async function runDealStructure(
  _input: DealStructureInput,
): Promise<DealStructureOutput> {
  return { ok: true, engine: "deal.structure" };
}
