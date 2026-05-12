/**
 * Quick check that DATABASE_URL reaches Postgres and can run a query.
 * Usage: `DATABASE_URL=... npm run db:verify`
 */
import postgres from "postgres";

function safeDbHost(urlString: string): string | undefined {
  try {
    const u = new URL(urlString);
    return u.hostname || undefined;
  } catch {
    return undefined;
  }
}

function dnsHint(hostname: string | undefined, errMsg: string): void {
  const lower = errMsg.toLowerCase();
  if (
    lower.includes("enotfound") ||
    lower.includes("getaddrinfo") ||
    lower.includes("name or service not known")
  ) {
    console.error("");
    console.error(
      "DNS did not resolve the database host. Common fixes:",
    );
    console.error(
      "  • Supabase → Project Settings → Database → copy the URI host exactly (db.<project-ref>.supabase.co).",
    );
    console.error(
      "  • Confirm the project is not paused/deleted; restore or create a project if needed.",
    );
    if (hostname) {
      console.error(`  • Tried host: ${hostname}`);
    }
    console.error(
      "  • On macOS: run `nslookup <host>` — you should see an A/AAAA answer before db:verify can succeed.",
    );
  }
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url || !url.trim()) {
    console.error(
      "DATABASE_URL is not set. Add it to .env.local or export it for this command.",
    );
    process.exit(1);
  }

  const host = safeDbHost(url);
  if (host) {
    console.log(`Checking connection to host: ${host}`);
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

    const [tbl] = await sql<{ n: string }[]>`
      select count(*)::text as n
      from information_schema.tables
      where table_schema = 'public' and table_name = 'events'
    `;
    if (Number(tbl?.n ?? "0") < 1) {
      console.error(
        "Table public.events not found. Apply drizzle/0003_events.sql (or npm run db:push) so admin analytics can persist events.",
      );
      process.exit(1);
    }
    const [cnt] = await sql<{ n: string }[]>`
      select count(*)::text as n from events
    `;
    console.log(`OK: public.events exists (row count ${cnt?.n ?? "0"}).`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Connection failed:", msg);
    dnsHint(host, msg);
    process.exit(1);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
