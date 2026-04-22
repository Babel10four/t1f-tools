import { describe, expect, it } from "vitest";
import { analyzeQuestion } from "./redact";

describe("analyzeQuestion", () => {
  it("detects SSN-like patterns", () => {
    const r = analyzeQuestion("Borrower 123-45-6789 info");
    expect(r.hasSensitivePattern).toBe(true);
  });

  it("detects decision language", () => {
    const r = analyzeQuestion("Will this loan be approved?");
    expect(r.asksDecision).toBe(true);
  });

  it("allows neutral policy questions", () => {
    const r = analyzeQuestion("What income documentation does the policy list?");
    expect(r.hasSensitivePattern).toBe(false);
    expect(r.asksDecision).toBe(false);
  });
});
