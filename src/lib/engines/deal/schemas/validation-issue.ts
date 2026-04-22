/** Structured validation issue for 400 envelopes (TICKET-001A). */
export type ValidationIssue = {
  path?: string;
  message: string;
  code?: string;
};
