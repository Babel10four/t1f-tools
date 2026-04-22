import type { UnknownRecord } from "../types";

export type IntelProspectInput = UnknownRecord;

export type IntelProspectOutput = {
  ok: true;
  engine: "intel.prospect";
};

export async function runIntelProspect(
  _input: IntelProspectInput,
): Promise<IntelProspectOutput> {
  return { ok: true, engine: "intel.prospect" };
}
