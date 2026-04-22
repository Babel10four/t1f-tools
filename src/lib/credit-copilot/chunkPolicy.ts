import type { PolicyChunk } from "./types";

/** Fixed v1 constants — same input always yields same chunks (TICKET-009). */
export const MAX_CHUNK_CHARS = 1200;
export const CHUNK_OVERLAP_CHARS = 200;

/**
 * Deterministic chunking: split on paragraph breaks, then hard-split long pieces with overlap.
 */
export function chunkPolicyText(extractedText: string): PolicyChunk[] {
  const normalized = extractedText.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [];
  }
  const paragraphs = normalized.split(/\n\n+/);
  const chunks: PolicyChunk[] = [];
  let idx = 0;
  for (const p of paragraphs) {
    const piece = p.trim();
    if (!piece) {
      continue;
    }
    if (piece.length <= MAX_CHUNK_CHARS) {
      chunks.push({ chunkId: `chunk-${idx}`, text: piece });
      idx += 1;
      continue;
    }
    let offset = 0;
    while (offset < piece.length) {
      const end = Math.min(offset + MAX_CHUNK_CHARS, piece.length);
      const slice = piece.slice(offset, end).trim();
      if (slice.length > 0) {
        chunks.push({ chunkId: `chunk-${idx}`, text: slice });
        idx += 1;
      }
      if (end >= piece.length) {
        break;
      }
      offset = end - CHUNK_OVERLAP_CHARS;
      if (offset < 0) {
        offset = 0;
      }
    }
  }
  return chunks;
}
