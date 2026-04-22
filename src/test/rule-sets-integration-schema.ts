import { readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

/**
 * Applies `drizzle/0001_documents.sql` then `drizzle/0002_rule_sets.sql` using a
 * standalone client (not `getDb()`), for integration tests.
 */
export async function applyRuleSetsIntegrationSchema(
  databaseUrl: string,
): Promise<void> {
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    const root = process.cwd();
    const documentsSql = readFileSync(
      join(root, "drizzle/0001_documents.sql"),
      "utf8",
    );
    const ruleSetsSql = readFileSync(
      join(root, "drizzle/0002_rule_sets.sql"),
      "utf8",
    );
    const eventsSql = readFileSync(join(root, "drizzle/0003_events.sql"), "utf8");
    const bindingsSql = readFileSync(
      join(root, "drizzle/0004_tool_context_bindings.sql"),
      "utf8",
    );
    await sql.unsafe(documentsSql);
    await sql.unsafe(ruleSetsSql);
    await sql.unsafe(eventsSql);
    await sql.unsafe(bindingsSql);
  } finally {
    await sql.end({ timeout: 5 });
  }
}
