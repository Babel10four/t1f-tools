/**
 * Quick check that DATABASE_URL reaches Postgres and can run a query.
 * Usage: `DATABASE_URL=... npm run db:verify`
 */
import postgres from "postgres";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url || !url.trim()) {
    console.error(
      "DATABASE_URL is not set. Add it to .env.local or export it for this command.",
    );
    process.exit(1);
  }

  const sql = postgres(url, { max: 1 });
  try {
    const rows = await sql<{ ok: number }[]>`select 1::int as ok`;
    if (rows[0]?.ok === 1) {
      console.log("OK: database connection successful (select 1).");
    } else {
      console.error("Unexpected result from select 1.");
      process.exit(1);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Connection failed:", msg);
    process.exit(1);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
