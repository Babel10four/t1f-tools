/**
 * Intelligence Layer — generic GPT structured-extraction helper.
 *
 * Calls OpenAI Chat Completions in JSON mode and safely parses the response into a typed
 * object. Modeled on `generateAnswerWithOpenAI` in `src/lib/credit-copilot/generate.ts`:
 * gated on `OPENAI_API_KEY`, raw `fetch`, no SDK. Returns a typed failure (never throws on
 * a missing key or a bad model response) so Intel engines can degrade gracefully.
 */

export type ExtractResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: "not_configured" | "request_failed" | "bad_response"; message: string };

export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

type ChatCompletionPayload = {
  choices?: { message?: { content?: string } }[];
};

export type ExtractOptions = {
  /** Override model (default: OPENAI_CHAT_MODEL env or gpt-4o-mini). */
  model?: string;
  /** Sampling temperature (default 0.2 — favor deterministic extraction). */
  temperature?: number;
};

/**
 * Extract a structured JSON object of shape `T` from `context` using `systemPrompt` for the
 * extraction contract and `schemaHint` to describe the exact JSON shape the model must emit.
 *
 * The caller is responsible for validating/narrowing the parsed object — this helper only
 * guarantees that a JSON object was returned and parsed.
 */
export async function extractStructured<T>(
  systemPrompt: string,
  context: string,
  schemaHint: string,
  opts?: ExtractOptions,
): Promise<ExtractResult<T>> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    return { ok: false, reason: "not_configured", message: "OPENAI_API_KEY is not configured" };
  }
  const body = {
    model: opts?.model ?? process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini",
    temperature: opts?.temperature ?? 0.2,
    response_format: { type: "json_object" as const },
    messages: [
      { role: "system" as const, content: systemPrompt },
      {
        role: "user" as const,
        content: `Source material:\n\n${context}\n\n---\n\nReturn ONLY a JSON object matching exactly this shape (no prose, no markdown fences):\n${schemaHint}`,
      },
    ],
  };
  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return {
      ok: false,
      reason: "request_failed",
      message: e instanceof Error ? e.message : "OpenAI network error",
    };
  }
  if (!res.ok) {
    const errText = await res.text();
    return {
      ok: false,
      reason: "request_failed",
      message: `OpenAI request failed (${res.status}): ${errText.slice(0, 200)}`,
    };
  }
  const json = (await res.json()) as ChatCompletionPayload;
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) {
    return { ok: false, reason: "bad_response", message: "Empty model response" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: "bad_response", message: "Model returned non-JSON content" };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, reason: "bad_response", message: "Model did not return a JSON object" };
  }
  return { ok: true, value: parsed as T };
}
