import type { DocumentRow } from "@/db/schema";

export type CreditCopilotStatus =
  | "answered"
  | "policy_unavailable"
  | "insufficient_policy_context"
  | "refused_sensitive_or_decision_request"
  | "error";

export type CreditCopilotCitation = {
  label: string;
  excerpt?: string;
  chunkId?: string;
};

export type CreditCopilotSourceDocument = {
  id: string;
  title: string;
  versionLabel?: string | null;
  publishedAt?: string | null;
};

export type CreditCopilotAskResponse = {
  status: CreditCopilotStatus;
  answer: string | null;
  citations: CreditCopilotCitation[];
  sourceDocument: CreditCopilotSourceDocument | null;
  warnings: string[];
  disclaimer: string;
  clientCorrelationId?: string;
};

export type PolicyChunk = {
  chunkId: string;
  text: string;
};

export type ScoredChunk = {
  chunk: PolicyChunk;
  score: number;
};

export function sourceDocumentFromRow(
  doc: DocumentRow,
): CreditCopilotSourceDocument {
  const publishedAt =
    doc.publishedAt instanceof Date
      ? doc.publishedAt.toISOString()
      : doc.publishedAt
        ? String(doc.publishedAt)
        : null;
  return {
    id: doc.id,
    title: doc.title,
    versionLabel: doc.versionLabel,
    publishedAt,
  };
}
