import { resolveToolBinding } from "@/lib/bindings/resolve";
import type { DocumentRow } from "@/db/schema";

export type ResolvedCreditPolicy =
  | { ok: true; document: DocumentRow }
  | { ok: false };

/**
 * Published credit policy only — CONTENT-002, no heuristics.
 */
export async function resolveCreditPolicyDocument(): Promise<ResolvedCreditPolicy> {
  const r = await resolveToolBinding(
    "credit_copilot",
    "credit_policy_document",
  );
  if (r.state !== "resolved" || r.kind !== "document") {
    return { ok: false };
  }
  return { ok: true, document: r.document };
}
