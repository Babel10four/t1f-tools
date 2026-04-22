import { describe, expect, it } from "vitest";
import { chunkPolicyText } from "./chunkPolicy";
import {
  rankChunks,
  retrievalIsStrongEnough,
  takeTopK,
  tokenizeForOverlap,
} from "./retrieve";

describe("retrieve (TICKET-009)", () => {
  it("ranks chunks by overlap with question", () => {
    const chunks = chunkPolicyText(
      "LTV requirements for bridge loans.\n\nCredit score minimums.\n\nUnrelated gardening tips.",
    );
    const ranked = rankChunks("LTV requirements bridge loans", chunks);
    expect(ranked[0]?.chunk.text.toLowerCase()).toContain("ltv");
    expect(ranked[0]!.score).toBeGreaterThan(ranked[ranked.length - 1]!.score);
  });

  it("retrievalIsStrongEnough uses token count heuristics", () => {
    expect(retrievalIsStrongEnough(3, 5)).toBe(true);
    expect(retrievalIsStrongEnough(2, 5)).toBe(false);
    expect(retrievalIsStrongEnough(1, 2)).toBe(true);
  });

  it("takeTopK filters zero scores", () => {
    const chunks = chunkPolicyText("aaa bbb.\n\nccc ddd.");
    const ranked = rankChunks("zzzunknown", chunks);
    const top = takeTopK(ranked, 5);
    expect(top.every((t) => t.score > 0)).toBe(true);
  });

  it("tokenizeForOverlap strips noise", () => {
    expect(tokenizeForOverlap("LTV, credit-score!")).toContain("credit");
  });
});
