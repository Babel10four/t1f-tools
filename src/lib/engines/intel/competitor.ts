import { and, desc, eq, lt } from "drizzle-orm";
import { getDb } from "@/db/client";
import { intelCompetitorSnapshots } from "@/db/schema";
import { sendCompetitorAlert } from "@/lib/intel/alerts";
import { extractStructured, isOpenAIConfigured } from "@/lib/intel/extract";
import { scrapeUrl } from "@/lib/intel/firecrawl";
import type { CompetitorParsed } from "@/lib/intel/types";

/** Competitors monitored by the nightly agent. URLs are best-known program pages. */
export const COMPETITORS: { name: string; url: string }[] = [
  { name: "Kiavi", url: "https://www.kiavi.com/" },
  { name: "Lima One", url: "https://www.limaone.com/" },
  { name: "New Silver", url: "https://newsilver.com/" },
  { name: "Easy Street Capital", url: "https://www.easystreetcap.com/" },
  { name: "RCN Capital", url: "https://www.rcncapital.com/" },
  { name: "Civic Financial", url: "https://www.civicfs.com/" },
];

const SYSTEM_PROMPT = `You extract lending program facts for a competitor of a private real-estate lender from the supplied web page text. Use ONLY the supplied text. Use null / empty arrays when a value is not present. Keep values short and factual (e.g. ltv: "Up to 85% LTC", rates: "from 9.99%").`;

const SCHEMA_HINT = `{
  "ltv": string | null,
  "rates": string | null,
  "states": string[],
  "programs": string[],
  "fees": string | null
}`;

export type CompetitorChange = {
  competitor: string;
  field: keyof CompetitorParsed;
  from: string;
  to: string;
};

export type CompetitorSweepResult = {
  ok: true;
  engine: "intel.competitor";
  capturedAt: string;
  scanned: number;
  stored: number;
  changes: CompetitorChange[];
  /** Email alert outcome (only attempted when changes are detected). */
  alert: { attempted: boolean; sent: boolean; reason: string | null };
  degraded: { firecrawl: boolean; openai: boolean; db: boolean };
  notes: string[];
};

function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim() !== "");
}

function asStringOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function normalizeParsed(raw: unknown): CompetitorParsed {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    ltv: asStringOrNull(r.ltv),
    rates: asStringOrNull(r.rates),
    states: strArray(r.states),
    programs: strArray(r.programs),
    fees: asStringOrNull(r.fees),
  };
}

function describe(value: CompetitorParsed[keyof CompetitorParsed]): string {
  if (Array.isArray(value)) return value.join(", ") || "(none)";
  return value ?? "(none)";
}

/** Compare two parsed snapshots and emit human-readable change records. */
function diffParsed(
  competitor: string,
  prev: CompetitorParsed,
  next: CompetitorParsed,
): CompetitorChange[] {
  const fields: (keyof CompetitorParsed)[] = [
    "ltv",
    "rates",
    "states",
    "programs",
    "fees",
  ];
  const changes: CompetitorChange[] = [];
  for (const field of fields) {
    const from = describe(prev[field]);
    const to = describe(next[field]);
    if (from !== to) {
      changes.push({ competitor, field, from, to });
    }
  }
  return changes;
}

/**
 * Competitor Intelligence (INTEL-001) nightly sweep. Scrapes each competitor, parses program
 * facts via GPT, stores a snapshot, and diffs against the previous snapshot to detect LTV/rate/
 * state/program/fee changes. Alert delivery (email/Slack) is deferred — changes are returned and
 * stored for in-app surfacing.
 */
export async function runCompetitorSweep(): Promise<CompetitorSweepResult> {
  const capturedAt = new Date().toISOString();
  const notes: string[] = [];
  const changes: CompetitorChange[] = [];
  const openaiConfigured = isOpenAIConfigured();
  let firecrawlDegraded = false;
  let dbDegraded = false;
  let scanned = 0;
  let stored = 0;

  for (const { name, url } of COMPETITORS) {
    const scraped = await scrapeUrl(url);
    if (!scraped.ok) {
      if (scraped.reason === "not_configured") {
        firecrawlDegraded = true;
        notes.push("Firecrawl not configured — competitor sweep skipped.");
        break;
      }
      notes.push(`${name}: scrape failed — ${scraped.message}`);
      continue;
    }
    scanned += 1;

    let parsed: CompetitorParsed | null = null;
    if (openaiConfigured) {
      const extracted = await extractStructured<Record<string, unknown>>(
        SYSTEM_PROMPT,
        `Competitor: ${name}\nURL: ${url}\n\n${scraped.markdown}`,
        SCHEMA_HINT,
      );
      if (extracted.ok) {
        parsed = normalizeParsed(extracted.value);
      } else {
        notes.push(`${name}: GPT parse failed — ${extracted.message}`);
      }
    }

    try {
      const db = getDb();
      // Diff against the most recent previous snapshot for this competitor.
      if (parsed) {
        const prevRows = await db
          .select({ parsed: intelCompetitorSnapshots.parsed })
          .from(intelCompetitorSnapshots)
          .where(
            and(
              eq(intelCompetitorSnapshots.competitor, name),
              lt(intelCompetitorSnapshots.capturedAt, new Date(capturedAt)),
            ),
          )
          .orderBy(desc(intelCompetitorSnapshots.capturedAt))
          .limit(1);
        const prevParsed = prevRows[0]?.parsed ?? null;
        if (prevParsed) {
          changes.push(...diffParsed(name, prevParsed, parsed));
        }
      }
      await db.insert(intelCompetitorSnapshots).values({
        competitor: name,
        rawMarkdown: scraped.markdown,
        parsed,
        sourceUrl: url,
      });
      stored += 1;
    } catch (e) {
      dbDegraded = true;
      notes.push(
        `${name}: not persisted — ${e instanceof Error ? e.message : "database unavailable"}.`,
      );
    }
  }

  // Alert delivery — email, only when changes were detected vs the previous snapshot.
  const alert = { attempted: false, sent: false, reason: null as string | null };
  if (changes.length > 0) {
    alert.attempted = true;
    const detectedOn = new Date(capturedAt).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const sent = await sendCompetitorAlert(changes, detectedOn);
    if (sent.ok) {
      alert.sent = true;
      notes.push(`Alert email sent to ${sent.to}.`);
    } else {
      alert.reason = sent.reason;
      if (sent.reason === "not_configured") {
        notes.push("RESEND_API_KEY not configured — alert email skipped.");
      } else {
        notes.push(`Alert email failed (${sent.reason}): ${sent.message}`);
      }
    }
  }

  return {
    ok: true,
    engine: "intel.competitor",
    capturedAt,
    scanned,
    stored,
    changes,
    alert,
    degraded: { firecrawl: firecrawlDegraded, openai: !openaiConfigured, db: dbDegraded },
    notes,
  };
}
