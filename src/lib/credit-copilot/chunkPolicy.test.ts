import { describe, expect, it } from "vitest";
import { chunkPolicyText } from "./chunkPolicy";

describe("chunkPolicyText", () => {
  it("is deterministic for the same input", () => {
    const text = "Para one.\n\nPara two.\n\nPara three.";
    expect(chunkPolicyText(text)).toEqual(chunkPolicyText(text));
  });

  it("returns empty for empty string", () => {
    expect(chunkPolicyText("   ")).toEqual([]);
  });
});
