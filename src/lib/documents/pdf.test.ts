import { describe, expect, it } from "vitest";
import { isLikelyPdf } from "./pdf";

describe("isLikelyPdf", () => {
  it("accepts minimal PDF header", () => {
    const buf = Buffer.from("%PDF-1.4\n");
    expect(isLikelyPdf(buf)).toBe(true);
  });

  it("rejects plain text", () => {
    const buf = Buffer.from("hello world");
    expect(isLikelyPdf(buf)).toBe(false);
  });

  it("rejects empty buffer", () => {
    expect(isLikelyPdf(Buffer.alloc(0))).toBe(false);
  });
});
