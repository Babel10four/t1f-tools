import type { ScoredChunk } from "./types";

const EXCERPT_CAP = 280;

export function excerptForCitation(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= EXCERPT_CAP) {
    return t;
  }
  return `${t.slice(0, EXCERPT_CAP)}…`;
}

const SYSTEM_PROMPT = `You are Credit Copilot, an internal assistant for licensed operations staff at a private lender.

You MUST answer ONLY using the policy excerpts provided in the user message. If the excerpts do not clearly address the question, say what is missing and tell the user to escalate to Credit or Underwriting.

Rules:
- Internal guidance only. Never address a borrower directly.
- Never state or imply approval, decline, guarantee, final determination, or that the user is "eligible" or "ineligible".
- If the user asks whether something will be approved or declined, refuse to decide and instead summarize only what the policy text says, then recommend escalation.
- Cite chunk ids in parentheses when referencing specifics (e.g. [chunk-0]).
- Be concise. Use bullet points when helpful.`;

/**
 * Closed-book generation via OpenAI Chat Completions (optional — requires OPENAI_API_KEY).
 */
export async function generateAnswerWithOpenAI(
  question: string,
  chunks: ScoredChunk[],
): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key?.trim()) {
    return { ok: false, message: "OPENAI_API_KEY is not configured" };
  }
  const context = chunks
    .map((s) => `[${s.chunk.chunkId}]\n${s.chunk.text}`)
    .join("\n\n---\n\n");
  const body = {
    model: process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      { role: "system" as const, content: SYSTEM_PROMPT },
      {
        role: "user" as const,
        content: `Published credit policy excerpts (your ONLY source):\n\n${context}\n\n---\n\nQuestion:\n${question}`,
      },
    ],
  };
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    return {
      ok: false,
      message: `OpenAI request failed (${res.status}): ${errText.slice(0, 200)}`,
    };
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) {
    return { ok: false, message: "Empty model response" };
  }
  return { ok: true, text };
}

/**
 * Deterministic fallback when no LLM: synthesize from top chunks only (still grounded).
 */
export function generateExtractiveAnswer(
  question: string,
  chunks: ScoredChunk[],
): string {
  const lines = chunks.map((s, i) => {
    const ex = excerptForCitation(s.chunk.text);
    return `${i + 1}. [${s.chunk.chunkId}] ${ex}`;
  });
  return [
    "The following passages are the most relevant retrieved excerpts from the published credit policy (internal use only). They may not fully answer your question — review the full policy and escalate to Credit / Underwriting when needed.",
    "",
    `Your question (for reference): ${question}`,
    "",
    "Retrieved excerpts:",
    ...lines,
    "",
    "No generative summary was produced (model not configured). Synthesize guidance from the excerpts above or consult the full policy document.",
  ].join("\n");
}
