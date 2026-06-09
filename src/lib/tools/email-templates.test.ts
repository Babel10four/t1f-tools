import { describe, expect, it } from "vitest";
import {
  EMAIL_TEMPLATES,
  EMAIL_TEMPLATE_CATEGORY_ORDER,
  extractTemplateVariables,
  templateToPlainText,
} from "./email-templates";

describe("email-templates library", () => {
  it("ships all 17 starter templates with unique ids and non-empty bodies", () => {
    expect(EMAIL_TEMPLATES).toHaveLength(17);
    const ids = EMAIL_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of EMAIL_TEMPLATES) {
      expect(t.title.trim()).not.toBe("");
      expect(t.body.trim()).not.toBe("");
    }
  });

  it("only uses categories declared in the display order", () => {
    const allowed = new Set(EMAIL_TEMPLATE_CATEGORY_ORDER);
    for (const t of EMAIL_TEMPLATES) {
      expect(allowed.has(t.category)).toBe(true);
    }
  });

  it("preserves literal dollar amounts in front of merge fields (no template interpolation)", () => {
    const approval = EMAIL_TEMPLATES.find((t) => t.id === "formal-approval")!;
    expect(approval.body).toContain("${{Initial Loan Amount}}");
    expect(approval.body).not.toContain("[object Object]");
  });

  it("extracts unique merge field names in first-seen order", () => {
    const intake = EMAIL_TEMPLATES.find((t) => t.id === "new-deal-intake")!;
    const vars = extractTemplateVariables(intake);
    expect(vars).toContain("Property Address");
    expect(vars).toContain("First Name");
    expect(vars).toContain("Your Cell");
    // First-seen order: subject mentions Property Address before the body greets First Name.
    expect(vars.indexOf("Property Address")).toBeLessThan(vars.indexOf("First Name"));
    expect(new Set(vars).size).toBe(vars.length);
  });

  it("templateToPlainText prefixes the subject when present and omits it otherwise", () => {
    const withSubject = EMAIL_TEMPLATES.find((t) => t.subject)!;
    expect(templateToPlainText(withSubject)).toContain(`Subject: ${withSubject.subject}`);

    const coldCall = EMAIL_TEMPLATES.find((t) => t.id === "cold-call-follow-up")!;
    expect(coldCall.subject).toBeUndefined();
    expect(templateToPlainText(coldCall).startsWith("Subject:")).toBe(false);
  });
});
