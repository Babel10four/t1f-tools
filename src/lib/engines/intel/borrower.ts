import { getDb } from "@/db/client";
import { intelBorrowerSnapshots } from "@/db/schema";
import { extractStructured, isOpenAIConfigured } from "@/lib/intel/extract";
import { scrapeUrl, search } from "@/lib/intel/firecrawl";
import type { BorrowerSnapshot, IntelSource } from "@/lib/intel/types";
import type { UnknownRecord } from "../types";

export type IntelBorrowerInput = UnknownRecord;

export type IntelBorrowerOutput = {
  ok: true;
  engine: "intel.borrower";
  borrowerName: string;
  entityName: string | null;
  website: string | null;
  snapshot: BorrowerSnapshot;
  sources: IntelSource[];
  /** Row id when persisted to Postgres; null when DB is unavailable. */
  persistedId: string | null;
  /** Which optional capabilities were unavailable for this run. */
  degraded: { firecrawl: boolean; openai: boolean; db: boolean };
  notes: string[];
};

const SYSTEM_PROMPT = `You are an intelligence analyst for a private real-estate lender. From the provided public web material about a borrower (an individual real-estate investor and/or their entity), produce a concise, factual snapshot to help an underwriter understand the borrower's experience and profile.

Rules:
- Use ONLY the supplied material. Do not invent specific numbers, addresses, or claims.
- When a value is unknown or unsupported, use null (numbers) or an empty array, and lower the confidence.
- "estimatedFlips" is your best supportable estimate of completed flips/projects (integer) or null.
- "primaryMarkets" are city/metro names the borrower appears to operate in.
- "likelyBuyBox.low"/"high" are estimated typical purchase price bounds in whole US dollars, or null.
- "riskFlags" are short phrases for concerns (litigation, complaints, thin track record, etc.); empty array if none found.
- "exitStrategyPatterns" are short phrases (e.g. "fix-and-flip", "BRRRR", "long-term rental").
- "confidence" reflects how much supporting material you actually had: "high" only with substantial corroborating sources, otherwise "medium" or "low".
- Keep "summary" to 2-4 sentences.`;

const SCHEMA_HINT = `{
  "summary": string,
  "experience": { "estimatedFlips": number | null, "note": string },
  "primaryMarkets": string[],
  "likelyBuyBox": { "low": number | null, "high": number | null, "note": string },
  "riskFlags": string[],
  "exitStrategyPatterns": string[],
  "confidence": "low" | "medium" | "high"
}`;

function asString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

function classifySource(url: string): IntelSource["kind"] {
  const u = url.toLowerCase();
  if (u.includes("linkedin.com")) return "linkedin";
  return "search";
}

function emptySnapshot(summary: string): BorrowerSnapshot {
  return {
    summary,
    experience: { estimatedFlips: null, note: "Not enough data." },
    primaryMarkets: [],
    likelyBuyBox: { low: null, high: null, note: "Not enough data." },
    riskFlags: [],
    exitStrategyPatterns: [],
    confidence: "low",
  };
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim() !== "");
}

function confidence(v: unknown): BorrowerSnapshot["confidence"] {
  return v === "high" || v === "medium" || v === "low" ? v : "low";
}

/** Coerce a loose model object into a valid {@link BorrowerSnapshot}. */
function normalizeSnapshot(raw: unknown): BorrowerSnapshot {
  const r = (raw ?? {}) as Record<string, unknown>;
  const exp = (r.experience ?? {}) as Record<string, unknown>;
  const box = (r.likelyBuyBox ?? {}) as Record<string, unknown>;
  return {
    summary: asString(r.summary) ?? "No summary produced.",
    experience: {
      estimatedFlips: num(exp.estimatedFlips),
      note: asString(exp.note) ?? "",
    },
    primaryMarkets: strArray(r.primaryMarkets),
    likelyBuyBox: {
      low: num(box.low),
      high: num(box.high),
      note: asString(box.note) ?? "",
    },
    riskFlags: strArray(r.riskFlags),
    exitStrategyPatterns: strArray(r.exitStrategyPatterns),
    confidence: confidence(r.confidence),
  };
}

const CONTEXT_CAP = 24_000;

/**
 * Borrower Intelligence (INTEL-001). Gathers public web material via Firecrawl, summarizes it
 * into a structured Borrower Snapshot via GPT, and persists it to Postgres. Degrades gracefully
 * when Firecrawl / OpenAI / DATABASE_URL are unavailable (returns a low-confidence partial
 * snapshot rather than throwing).
 */
export async function runIntelBorrower(
  input: IntelBorrowerInput,
): Promise<IntelBorrowerOutput> {
  const borrowerName = asString(input.borrowerName);
  if (!borrowerName) {
    throw new Error("borrowerName is required");
  }
  const entityName = asString(input.entityName);
  const website = asString(input.website);

  const notes: string[] = [];
  const sources: IntelSource[] = [];
  const contextParts: string[] = [];

  // 1) Scrape the provided website (if any).
  if (website) {
    const scraped = await scrapeUrl(website);
    if (scraped.ok) {
      sources.push({ url: scraped.url, title: scraped.title, kind: "website" });
      contextParts.push(`# Borrower website (${website})\n${scraped.markdown}`);
    } else if (scraped.reason === "not_configured") {
      notes.push("Firecrawl not configured — skipped website scrape.");
    } else {
      notes.push(`Website scrape failed: ${scraped.message}`);
    }
  }

  // 2) Search the web for the borrower / entity across LinkedIn, Google, public profiles.
  const subject = [borrowerName, entityName].filter(Boolean).join(" ");
  const queries = [
    `${subject} real estate investor flips`,
    `${borrowerName} ${entityName ?? ""} LinkedIn`.trim(),
  ];
  let firecrawlConfigured = true;
  for (const query of queries) {
    const result = await search(query, { limit: 5, scrapeResults: false });
    if (result.ok) {
      for (const hit of result.hits) {
        sources.push({
          url: hit.url,
          title: hit.title,
          kind: classifySource(hit.url),
        });
        const piece = [hit.title, hit.description, hit.markdown]
          .filter(Boolean)
          .join("\n");
        if (piece) {
          contextParts.push(`# Search result (${hit.url})\n${piece}`);
        }
      }
    } else if (result.reason === "not_configured") {
      firecrawlConfigured = false;
      break;
    } else {
      notes.push(`Search failed for "${query}": ${result.message}`);
    }
  }
  if (!firecrawlConfigured) {
    notes.push("Firecrawl not configured — skipped web search.");
  }

  // 3) Summarize gathered material into a structured snapshot via GPT.
  const openaiConfigured = isOpenAIConfigured();
  let snapshot: BorrowerSnapshot;
  const context = contextParts.join("\n\n---\n\n").slice(0, CONTEXT_CAP);

  if (!context.trim()) {
    snapshot = emptySnapshot(
      `No public web material was gathered for ${borrowerName}${
        entityName ? ` (${entityName})` : ""
      }. Provide a website or configure Firecrawl for richer intelligence.`,
    );
  } else if (!openaiConfigured) {
    notes.push("OPENAI_API_KEY not configured — returned raw sources without GPT summary.");
    snapshot = emptySnapshot(
      `Gathered ${sources.length} source(s) for ${borrowerName} but GPT summarization is unavailable (OPENAI_API_KEY not set).`,
    );
  } else {
    const subjectLine = `Borrower: ${borrowerName}${
      entityName ? `\nEntity: ${entityName}` : ""
    }${website ? `\nWebsite: ${website}` : ""}\n\n`;
    const extracted = await extractStructured<Record<string, unknown>>(
      SYSTEM_PROMPT,
      subjectLine + context,
      SCHEMA_HINT,
    );
    if (extracted.ok) {
      snapshot = normalizeSnapshot(extracted.value);
    } else {
      notes.push(`GPT extraction failed (${extracted.reason}): ${extracted.message}`);
      snapshot = emptySnapshot(
        `Gathered ${sources.length} source(s) for ${borrowerName} but GPT extraction failed.`,
      );
    }
  }

  // 4) Persist to Postgres (best-effort — never fail the run on a DB outage).
  let persistedId: string | null = null;
  let dbDegraded = false;
  try {
    const rows = await getDb()
      .insert(intelBorrowerSnapshots)
      .values({ borrowerName, entityName, website, snapshot, sources })
      .returning({ id: intelBorrowerSnapshots.id });
    persistedId = rows[0]?.id ?? null;
  } catch (e) {
    dbDegraded = true;
    notes.push(
      `Snapshot not persisted: ${e instanceof Error ? e.message : "database unavailable"}.`,
    );
  }

  return {
    ok: true,
    engine: "intel.borrower",
    borrowerName,
    entityName,
    website,
    snapshot,
    sources,
    persistedId,
    degraded: {
      firecrawl: !firecrawlConfigured,
      openai: !openaiConfigured,
      db: dbDegraded,
    },
    notes,
  };
}
