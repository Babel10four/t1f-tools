import { enqueuePlatformEvent } from "@/lib/analytics/log-event";
import { CREDIT_COPILOT_DISCLAIMER } from "@/lib/credit-copilot/disclaimer";
import {
  MAX_QUESTION_LEN,
  runCreditCopilotAsk,
} from "@/lib/credit-copilot/runAsk";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

export async function POST(req: Request) {
  let raw: unknown;
  try {
    const text = await req.text();
    if (!text.trim()) {
      return Response.json({ error: "Empty request body" }, { status: 400 });
    }
    raw = JSON.parse(text);
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!isPlainObject(raw)) {
    return Response.json({ error: "Expected JSON object body" }, { status: 400 });
  }

  const question = raw.question;
  if (typeof question !== "string") {
    return Response.json({ error: "Field `question` must be a string" }, { status: 400 });
  }
  const trimmed = question.trim();
  if (!trimmed) {
    return Response.json(
      { error: "`question` must be non-empty after trim" },
      { status: 400 },
    );
  }
  if (question.length > MAX_QUESTION_LEN) {
    return Response.json(
      { error: `question exceeds ${MAX_QUESTION_LEN} characters` },
      { status: 400 },
    );
  }

  const clientCorrelationId =
    typeof raw.clientCorrelationId === "string"
      ? raw.clientCorrelationId
      : undefined;

  try {
    const result = await runCreditCopilotAsk({
      question,
      clientCorrelationId,
    });

    const hasPolicyBinding = result.sourceDocument !== null;
    const refusedSensitiveInput =
      result.status === "refused_sensitive_or_decision_request" &&
      result.warnings.some((w) => /Sensitive input pattern detected/i.test(w));

    enqueuePlatformEvent({
      req,
      eventType: "credit_copilot_question",
      toolKey: "credit_copilot",
      route: "/api/credit-copilot/ask",
      status: "success",
      metadata: {
        status: result.status,
        hasPolicyBinding,
        sourceDocumentId: result.sourceDocument?.id ?? null,
        citationCount: result.citations.length,
        questionLength: trimmed.length,
        refusedSensitiveInput,
      },
    });

    const body: Record<string, unknown> = { ...result };
    if (clientCorrelationId !== undefined) {
      body.clientCorrelationId = clientCorrelationId;
    }
    return Response.json(body);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    enqueuePlatformEvent({
      req,
      eventType: "credit_copilot_question",
      toolKey: "credit_copilot",
      route: "/api/credit-copilot/ask",
      status: "error",
      metadata: {
        status: "error",
        hasPolicyBinding: false,
        sourceDocumentId: null,
        citationCount: 0,
        questionLength: trimmed.length,
        refusedSensitiveInput: false,
        httpStatus: 500,
        code: "INTERNAL",
      },
    });
    return Response.json(
      {
        status: "error" as const,
        answer: null,
        citations: [] as const,
        sourceDocument: null,
        warnings: [message.slice(0, 500)],
        disclaimer: CREDIT_COPILOT_DISCLAIMER,
      },
      { status: 500 },
    );
  }
}
