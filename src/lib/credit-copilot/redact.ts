/**
 * Best-effort sensitive-input detection (TICKET-009). Not a complete DLP suite.
 */

const SSN_LIKE = /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/;
const LONG_DIGIT_RUN = /\b\d{9,}\b/;
const DOB_LIKE =
  /\b(0?[1-9]|1[0-2])[/-](0?[1-9]|[12]\d|3[01])[/-](19|20)\d{2}\b/;
const DECISION_ASK = new RegExp(
  [
    "\\b(approve|approved|approval|decline|declined|deny|denied|reject|rejected)\\b",
    "\\b(guarantee|guaranteed)\\b",
    "\\b(final\\s+(decision|approval|answer))\\b",
    "\\b(definitely\\s+eligible|will\\s+i\\s+get\\s+approved)\\b",
    "\\b(should\\s+we\\s+(approve|decline))\\b",
  ].join("|"),
  "i",
);

export type RedactQuestionResult = {
  /** Trimmed question safe to send to the model after optional redaction. */
  text: string;
  /** True if obvious PII-like patterns were found. */
  hasSensitivePattern: boolean;
  /** True if the question appears to ask for an approval/decline decision. */
  asksDecision: boolean;
};

export function analyzeQuestion(raw: string): RedactQuestionResult {
  const text = raw.trim();
  const hasSensitivePattern =
    SSN_LIKE.test(text) ||
    LONG_DIGIT_RUN.test(text) ||
    DOB_LIKE.test(text);
  const asksDecision = DECISION_ASK.test(text);
  return { text, hasSensitivePattern, asksDecision };
}
