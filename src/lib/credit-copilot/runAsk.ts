import { CREDIT_COPILOT_DISCLAIMER } from "./disclaimer";
import { chunkPolicyText } from "./chunkPolicy";
import { generateAnswerWithOpenAI, generateExtractiveAnswer, excerptForCitation } from "./generate";
import { analyzeQuestion } from "./redact";
import {
  rankChunks,
  retrievalIsStrongEnough,
  takeTopK,
  tokenizeForOverlap,
  TOP_K,
} from "./retrieve";
import { resolveCreditPolicyDocument } from "./resolvePolicy";
import type {
  CreditCopilotAskResponse,
  CreditCopilotCitation,
  CreditCopilotStatus,
} from "./types";
import { sourceDocumentFromRow } from "./types";

export const MAX_QUESTION_LEN = 4000;
const MIN_POLICY_TEXT_LEN = 50;

export type RunAskInput = {
  question: string;
  clientCorrelationId?: string;
};

function baseResponse(
  status: CreditCopilotStatus,
  partial: Omit<
    CreditCopilotAskResponse,
    "status" | "disclaimer"
  >,
): CreditCopilotAskResponse {
  return {
    status,
    disclaimer: CREDIT_COPILOT_DISCLAIMER,
    ...partial,
  };
}

export async function runCreditCopilotAsk(
  input: RunAskInput,
): Promise<CreditCopilotAskResponse> {
  const qRaw = typeof input.question === "string" ? input.question : "";
  const analyzed = analyzeQuestion(qRaw);
  if (analyzed.hasSensitivePattern) {
    return baseResponse("refused_sensitive_or_decision_request", {
      answer:
        "This question was not processed because it may contain sensitive patterns (for example SSN-like or long numeric sequences). Remove sensitive data and ask a general policy question, or escalate through your internal channels.",
      citations: [],
      sourceDocument: null,
      warnings: [
        "Sensitive input pattern detected.",
        "Do not paste SSNs, DOB, full borrower identifiers, or file numbers into Credit Copilot.",
      ],
      clientCorrelationId: input.clientCorrelationId,
    });
  }
  if (analyzed.asksDecision) {
    return baseResponse("refused_sensitive_or_decision_request", {
      answer:
        "Credit Copilot cannot provide approval, decline, or guarantee outcomes. Summarize the policy-relevant facts and escalate to Credit or Underwriting for a decision. You can rephrase your question to ask what the published policy states about a topic (for example eligibility criteria or documentation requirements) without requesting a file decision.",
      citations: [],
      sourceDocument: null,
      warnings: [
        "Decision-style questions are blocked in v1 — use policy-fact questions instead.",
      ],
      clientCorrelationId: input.clientCorrelationId,
    });
  }

  const question = analyzed.text;

  const resolved = await resolveCreditPolicyDocument();
  if (!resolved.ok) {
    return baseResponse("policy_unavailable", {
      answer:
        "No published credit policy is bound for Credit Copilot. An administrator must publish a credit_policy document and a CONTENT-002 binding for credit_copilot + credit_policy_document.",
      citations: [],
      sourceDocument: null,
      warnings: [
        "A published CONTENT-002 binding is required: credit_copilot + credit_policy_document.",
      ],
      clientCorrelationId: input.clientCorrelationId,
    });
  }

  const doc = resolved.document;
  const sourceDocument = sourceDocumentFromRow(doc);
  const extracted = doc.extractedText?.trim() ?? "";

  if (extracted.length < MIN_POLICY_TEXT_LEN) {
    return baseResponse("insufficient_policy_context", {
      answer:
        "The bound credit policy document has no usable extracted text in the database. Re-upload or re-publish the document so extracted_text is populated (admin pipeline) — Credit Copilot cannot read PDF bytes at runtime.",
      citations: [],
      sourceDocument,
      warnings: [
        "extracted_text is missing or too short — policy text must be stored for retrieval.",
      ],
      clientCorrelationId: input.clientCorrelationId,
    });
  }

  const chunks = chunkPolicyText(extracted);
  if (chunks.length === 0) {
    return baseResponse("insufficient_policy_context", {
      answer: null,
      citations: [],
      sourceDocument,
      warnings: ["Policy text could not be chunked for retrieval."],
      clientCorrelationId: input.clientCorrelationId,
    });
  }

  const ranked = rankChunks(question, chunks);
  const top = takeTopK(ranked, TOP_K);
  const qTokens = tokenizeForOverlap(question);
  const bestScore = ranked[0]?.score ?? 0;

  if (
    top.length === 0 ||
    !retrievalIsStrongEnough(bestScore, qTokens.length)
  ) {
    return baseResponse("insufficient_policy_context", {
      answer:
        "The published policy does not contain clearly relevant passages for this question (retrieval confidence is low), or the topic may not be addressed in the document. Try different keywords, consult the full policy PDF through normal channels, or escalate to Credit / Underwriting.",
      citations: [],
      sourceDocument,
      warnings: [
        "No chunk met the minimum relevance threshold — do not treat this as confirmation the policy is silent; the excerpt index may be incomplete.",
      ],
      clientCorrelationId: input.clientCorrelationId,
    });
  }

  const citations: CreditCopilotCitation[] = top.map((s) => ({
    label: `Policy excerpt ${s.chunk.chunkId}`,
    excerpt: excerptForCitation(s.chunk.text),
    chunkId: s.chunk.chunkId,
  }));

  const warnings: string[] = [];

  const llm = await generateAnswerWithOpenAI(question, top);
  if (llm.ok) {
    return baseResponse("answered", {
      answer: llm.text,
      citations,
      sourceDocument,
      warnings,
      clientCorrelationId: input.clientCorrelationId,
    });
  }

  warnings.push(
    "Generative model unavailable — showing excerpt-only synthesis. Configure OPENAI_API_KEY for summarized answers.",
  );
  const extractive = generateExtractiveAnswer(question, top);
  return baseResponse("answered", {
    answer: extractive,
    citations,
    sourceDocument,
    warnings,
    clientCorrelationId: input.clientCorrelationId,
  });
}
