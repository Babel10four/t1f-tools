export const DOCUMENT_TYPES = [
  "credit_policy",
  "rural_policy",
  "reference_guidance",
  "qa_corpus",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_STATUSES = ["draft", "published", "archived"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];
