/**
 * Intelligence Layer — Firecrawl client.
 *
 * Thin raw-`fetch` wrapper over the Firecrawl REST API (scrape + search) returning clean
 * markdown. Mirrors the optional-key gating used by the OpenAI client in
 * `src/lib/credit-copilot/generate.ts`: when `FIRECRAWL_API_KEY` is missing we return a
 * typed `{ ok: false, reason: "not_configured" }` instead of throwing, so Intel engines can
 * degrade gracefully rather than 500.
 */

const DEFAULT_API_BASE = "https://api.firecrawl.dev";

/** Cap stored/forwarded markdown so a single page cannot blow up GPT context or DB rows. */
export const FIRECRAWL_MARKDOWN_CAP = 20_000;

export type FirecrawlNotConfigured = {
  ok: false;
  reason: "not_configured";
  message: string;
};

export type FirecrawlError = {
  ok: false;
  reason: "request_failed" | "empty_result";
  message: string;
};

export type FirecrawlScrapeResult =
  | { ok: true; url: string; markdown: string; title?: string }
  | FirecrawlNotConfigured
  | FirecrawlError;

export type FirecrawlSearchHit = {
  url: string;
  title?: string;
  description?: string;
  markdown?: string;
};

export type FirecrawlSearchResult =
  | { ok: true; query: string; hits: FirecrawlSearchHit[] }
  | FirecrawlNotConfigured
  | FirecrawlError;

export function isFirecrawlConfigured(): boolean {
  return Boolean(process.env.FIRECRAWL_API_KEY?.trim());
}

function apiBase(): string {
  return process.env.FIRECRAWL_API_BASE?.trim() || DEFAULT_API_BASE;
}

function capMarkdown(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  if (trimmed.length <= FIRECRAWL_MARKDOWN_CAP) {
    return trimmed;
  }
  return `${trimmed.slice(0, FIRECRAWL_MARKDOWN_CAP)}…`;
}

const NOT_CONFIGURED: FirecrawlNotConfigured = {
  ok: false,
  reason: "not_configured",
  message: "FIRECRAWL_API_KEY is not configured",
};

type FirecrawlScrapePayload = {
  data?: {
    markdown?: string;
    metadata?: { title?: string };
  };
};

type FirecrawlSearchPayload = {
  data?: Array<{
    url?: string;
    title?: string;
    description?: string;
    markdown?: string;
  }>;
};

/**
 * Scrape a single URL to clean markdown. Returns `not_configured` when the key is missing.
 */
export async function scrapeUrl(url: string): Promise<FirecrawlScrapeResult> {
  const key = process.env.FIRECRAWL_API_KEY?.trim();
  if (!key) {
    return NOT_CONFIGURED;
  }
  let res: Response;
  try {
    res = await fetch(`${apiBase()}/v1/scrape`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
    });
  } catch (e) {
    return {
      ok: false,
      reason: "request_failed",
      message: e instanceof Error ? e.message : "Firecrawl scrape network error",
    };
  }
  if (!res.ok) {
    const errText = await res.text();
    return {
      ok: false,
      reason: "request_failed",
      message: `Firecrawl scrape failed (${res.status}): ${errText.slice(0, 200)}`,
    };
  }
  const json = (await res.json()) as FirecrawlScrapePayload;
  const markdown = capMarkdown(json.data?.markdown);
  if (!markdown) {
    return { ok: false, reason: "empty_result", message: "Firecrawl returned no markdown" };
  }
  return {
    ok: true,
    url,
    markdown,
    title: json.data?.metadata?.title,
  };
}

/**
 * Search the web and (optionally) scrape result pages to markdown. Returns `not_configured`
 * when the key is missing.
 */
export async function search(
  query: string,
  opts?: { limit?: number; scrapeResults?: boolean },
): Promise<FirecrawlSearchResult> {
  const key = process.env.FIRECRAWL_API_KEY?.trim();
  if (!key) {
    return NOT_CONFIGURED;
  }
  const limit = Math.max(1, Math.min(opts?.limit ?? 5, 10));
  const body: Record<string, unknown> = { query, limit };
  if (opts?.scrapeResults) {
    body.scrapeOptions = { formats: ["markdown"], onlyMainContent: true };
  }
  let res: Response;
  try {
    res = await fetch(`${apiBase()}/v1/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return {
      ok: false,
      reason: "request_failed",
      message: e instanceof Error ? e.message : "Firecrawl search network error",
    };
  }
  if (!res.ok) {
    const errText = await res.text();
    return {
      ok: false,
      reason: "request_failed",
      message: `Firecrawl search failed (${res.status}): ${errText.slice(0, 200)}`,
    };
  }
  const json = (await res.json()) as FirecrawlSearchPayload;
  const hits: FirecrawlSearchHit[] = (json.data ?? [])
    .filter((d): d is { url: string } & typeof d => typeof d.url === "string")
    .map((d) => ({
      url: d.url,
      title: d.title,
      description: d.description,
      markdown: d.markdown ? capMarkdown(d.markdown) : undefined,
    }));
  if (hits.length === 0) {
    return { ok: false, reason: "empty_result", message: "Firecrawl returned no results" };
  }
  return { ok: true, query, hits };
}
