import { describe, expect, it } from "vitest";
import { clientSafeDatabaseErrorMessage } from "./client-safe-error-message";

describe("clientSafeDatabaseErrorMessage", () => {
  it("preserves explicit DATABASE_URL guidance from getDb()", () => {
    const msg =
      "DATABASE_URL is not set. This deployment needs Postgres for published rule bindings";
    expect(clientSafeDatabaseErrorMessage(msg)).toBe(msg);
  });

  it("replaces postgres-js Failed query leaks", () => {
    const raw = `Failed query: select "id" from "tool_context_bindings" where ($1) params: rural_checker`;
    expect(clientSafeDatabaseErrorMessage(raw)).toMatch(
      /could not load its published configuration/i,
    );
    expect(clientSafeDatabaseErrorMessage(raw)).not.toMatch(/Failed query:/i);
    expect(clientSafeDatabaseErrorMessage(raw)).not.toMatch(/select\s+"id"/i);
  });

  it("replaces missing relation errors", () => {
    expect(
      clientSafeDatabaseErrorMessage(
        'relation "tool_context_bindings" does not exist',
      ),
    ).not.toMatch(/relation/i);
  });

  it("passes through application validation errors", () => {
    const msg = "Published rural rules payload failed validation: missing field x";
    expect(clientSafeDatabaseErrorMessage(msg)).toBe(msg);
  });
});
