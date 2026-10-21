import { readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

/**
 * Applies the rule lifecycle schema and server-only policy permissions using a
 * standalone client (not `getDb()`), so CI also exercises lifecycle writes with RLS enabled.
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
    await sql.unsafe(readFileSync(
      join(root, "drizzle/0006_policy_configuration_permissions.sql"),
      "utf8",
    ));
  } finally {
    await sql.end({ timeout: 5 });
  }
}
