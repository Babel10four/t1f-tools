import { getDb } from "@/db/client";
import { intelPropertyDossiers } from "@/db/schema";
import { extractStructured, isOpenAIConfigured } from "@/lib/intel/extract";
import { search } from "@/lib/intel/firecrawl";
import type { IntelSource, PropertyDossier } from "@/lib/intel/types";
import type { UnknownRecord } from "../types";

export type PropertyDossierInput = UnknownRecord;

export type PropertyDossierOutput = {
  ok: true;
  engine: "property.dossier";
  address: string;
  dossier: PropertyDossier;
  sources: IntelSource[];
  persistedId: string | null;
  degraded: { firecrawl: boolean; openai: boolean; db: boolean };
  notes: string[];
};

const SYSTEM_PROMPT = `You assemble a factual property dossier for a private real-estate lender from public listing and records material (Zillow, Redfin, Realtor, county/public records). Use ONLY the supplied material. When a section is unknown, return an empty array or empty string and lower confidence. Keep each list item to a short factual line.`;

const SCHEMA_HINT = `{
  "listingHistory": string[],
  "priceChanges": string[],
  "priorSales": string[],
  "taxHistory": string[],
  "marketNotes": string,
  "neighborhoodNotes": string,
  "confidence": "low" | "medium" | "high"
}`;

function asString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim() !== "");
}

function confidence(v: unknown): PropertyDossier["confidence"] {
  return v === "high" || v === "medium" || v === "low" ? v : "low";
}

function emptyDossier(): PropertyDossier {
  return {
    listingHistory: [],
    priceChanges: [],
    priorSales: [],
    taxHistory: [],
    marketNotes: "",
    neighborhoodNotes: "",
    confidence: "low",
  };
}

function normalizeDossier(raw: unknown): PropertyDossier {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    listingHistory: strArray(r.listingHistory),
    priceChanges: strArray(r.priceChanges),
    priorSales: strArray(r.priorSales),
    taxHistory: strArray(r.taxHistory),
    marketNotes: asString(r.marketNotes) ?? "",
    neighborhoodNotes: asString(r.neighborhoodNotes) ?? "",
    confidence: confidence(r.confidence),
  };
}

const CONTEXT_CAP = 24_000;

/**
 * Property Intelligence (INTEL-001, scaffold). Gathers public listing/records material for an
 * address via Firecrawl, summarizes into a {@link PropertyDossier} via GPT, and persists it.
 * Mirrors the Borrower engine's graceful-degradation contract. Triggered automatically when an
 * address is entered (wire from the relevant tools as a follow-up).
 */
export async function runPropertyDossier(
  input: PropertyDossierInput,
): Promise<PropertyDossierOutput> {
  const address = asString(input.address);
  if (!address) {
    throw new Error("address is required");
  }

  const notes: string[] = [];
  const sources: IntelSource[] = [];
  const contextParts: string[] = [];

  const queries = [
    `${address} Zillow Redfin Realtor listing price history`,
    `${address} county tax records prior sale`,
  ];
  let firecrawlConfigured = true;
  for (const query of queries) {
    const result = await search(query, { limit: 5, scrapeResults: true });
    if (result.ok) {
      for (const hit of result.hits) {
        sources.push({ url: hit.url, title: hit.title, kind: "search" });
        const piece = [hit.title, hit.description, hit.markdown]
          .filter(Boolean)
          .join("\n");
        if (piece) contextParts.push(`# ${hit.url}\n${piece}`);
      }
    } else if (result.reason === "not_configured") {
      firecrawlConfigured = false;
      break;
    } else {
      notes.push(`Search failed for "${query}": ${result.message}`);
    }
  }
  if (!firecrawlConfigured) {
    notes.push("Firecrawl not configured — skipped web gathering.");
  }

  const openaiConfigured = isOpenAIConfigured();
  let dossier: PropertyDossier;
  const context = contextParts.join("\n\n---\n\n").slice(0, CONTEXT_CAP);

  if (!context.trim() || !openaiConfigured) {
    if (!openaiConfigured && context.trim()) {
      notes.push("OPENAI_API_KEY not configured — returned raw sources without GPT summary.");
    }
    dossier = emptyDossier();
  } else {
    const extracted = await extractStructured<Record<string, unknown>>(
      SYSTEM_PROMPT,
      `Address: ${address}\n\n${context}`,
      SCHEMA_HINT,
    );
    if (extracted.ok) {
      dossier = normalizeDossier(extracted.value);
    } else {
      notes.push(`GPT extraction failed (${extracted.reason}): ${extracted.message}`);
      dossier = emptyDossier();
    }
  }

  let persistedId: string | null = null;
  let dbDegraded = false;
  try {
    const rows = await getDb()
      .insert(intelPropertyDossiers)
      .values({ address, dossier, sources })
      .returning({ id: intelPropertyDossiers.id });
    persistedId = rows[0]?.id ?? null;
  } catch (e) {
    dbDegraded = true;
    notes.push(
      `Dossier not persisted: ${e instanceof Error ? e.message : "database unavailable"}.`,
    );
  }

  return {
    ok: true,
    engine: "property.dossier",
    address,
    dossier,
    sources,
    persistedId,
    degraded: { firecrawl: !firecrawlConfigured, openai: !openaiConfigured, db: dbDegraded },
    notes,
  };
}
