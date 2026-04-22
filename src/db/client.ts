import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let client: ReturnType<typeof postgres> | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set — required for admin documents (CONTENT-001).",
    );
  }
  if (!db) {
    client = postgres(url, { max: 10 });
    db = drizzle(client, { schema });
  }
  return db;
}

export type Db = ReturnType<typeof getDb>;

/**
 * Vitest-only: closes the singleton pool so a different `DATABASE_URL` can be used
 * (e.g. CONFIG-001A integration tests against a dedicated Postgres URL).
 */
export async function resetDbClientForTests(): Promise<void> {
  if (!process.env.VITEST) {
    throw new Error("resetDbClientForTests is only available under Vitest");
  }
  if (client) {
    await client.end({ timeout: 5 });
  }
  client = null;
  db = null;
}
