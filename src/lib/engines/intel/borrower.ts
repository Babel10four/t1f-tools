import type { UnknownRecord } from "../types";

export type IntelBorrowerInput = UnknownRecord;

export type IntelBorrowerOutput = {
  ok: true;
  engine: "intel.borrower";
};

export async function runIntelBorrower(
  _input: IntelBorrowerInput,
): Promise<IntelBorrowerOutput> {
  return { ok: true, engine: "intel.borrower" };
}
