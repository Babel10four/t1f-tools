import type { PolicyChunk, ScoredChunk } from "./types";

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "this",
  "that",
  "from",
  "are",
  "was",
  "what",
  "when",
  "how",
  "can",
  "does",
  "did",
  "will",
  "not",
  "any",
  "all",
  "per",
  "our",
  "your",
  "into",
  "about",
  "but",
  "has",
  "have",
  "had",
  "its",
  "than",
  "then",
  "they",
  "them",
  "such",
  "also",
]);

/** Top-k chunks for v1 — fixed constant. */
export const TOP_K = 5;

export function tokenizeForOverlap(text: string): string[] {
  const t = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0);
  const out: string[] = [];
  for (const w of t) {
    if (w.length <= 2 && !/\d/.test(w)) {
      continue;
    }
    if (STOPWORDS.has(w)) {
      continue;
    }
    out.push(w);
  }
  return out;
}

function scoreChunk(questionTokens: Set<string>, chunkText: string): number {
  const chunkTokens = tokenizeForOverlap(chunkText);
  let score = 0;
  for (const ct of chunkTokens) {
    if (questionTokens.has(ct)) {
      score += 1;
    }
  }
  return score;
}

/**
 * Deterministic lexical overlap: count of question tokens appearing in chunk (bag-of-words).
 */
export function rankChunks(
  question: string,
  chunks: PolicyChunk[],
): ScoredChunk[] {
  const qTokens = tokenizeForOverlap(question);
  const qSet = new Set(qTokens);
  const scored: ScoredChunk[] = [];
  for (const chunk of chunks) {
    scored.push({
      chunk,
      score: scoreChunk(qSet, chunk.text),
    });
  }
  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.chunk.chunkId.localeCompare(b.chunk.chunkId);
  });
  return scored;
}

export function retrievalIsStrongEnough(
  bestScore: number,
  questionTokenCount: number,
): boolean {
  if (bestScore < 1) {
    return false;
  }
  if (questionTokenCount <= 2) {
    return bestScore >= 1;
  }
  return bestScore >= 3;
}

export function takeTopK(scored: ScoredChunk[], k: number): ScoredChunk[] {
  return scored.filter((s) => s.score > 0).slice(0, k);
}
