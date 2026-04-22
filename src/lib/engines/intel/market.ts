import type { UnknownRecord } from "../types";

export type IntelMarketInput = UnknownRecord;

export type IntelMarketOutput = {
  ok: true;
  engine: "intel.market";
};

export async function runIntelMarket(
  _input: IntelMarketInput,
): Promise<IntelMarketOutput> {
  return { ok: true, engine: "intel.market" };
}
