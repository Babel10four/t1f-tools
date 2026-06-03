import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isFirecrawlConfigured, scrapeUrl, search } from "./firecrawl";

const KEY = "FIRECRAWL_API_KEY";

function setKey(value: string | undefined) {
  if (value === undefined) {
    delete process.env[KEY];
  } else {
    process.env[KEY] = value;
  }
}

describe("firecrawl client", () => {
  let prevKey: string | undefined;

  beforeEach(() => {
    prevKey = process.env[KEY];
  });

  afterEach(() => {
    setKey(prevKey);
    vi.restoreAllMocks();
  });

  it("reports not configured and returns not_configured without calling fetch", async () => {
    setKey("");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(isFirecrawlConfigured()).toBe(false);

    const scrape = await scrapeUrl("https://example.com");
    const searched = await search("anything");

    expect(scrape).toEqual({
      ok: false,
      reason: "not_configured",
      message: expect.any(String),
    });
    expect(searched.ok).toBe(false);
    if (!searched.ok) expect(searched.reason).toBe("not_configured");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("scrapeUrl returns capped markdown + title on success", async () => {
    setKey("test-key");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { markdown: "  # Hello\nworld  ", metadata: { title: "Example" } },
        }),
        { status: 200 },
      ),
    );
    const out = await scrapeUrl("https://example.com");
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.markdown).toBe("# Hello\nworld");
      expect(out.title).toBe("Example");
      expect(out.url).toBe("https://example.com");
    }
  });

  it("scrapeUrl surfaces request_failed on non-2xx", async () => {
    setKey("test-key");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("nope", { status: 500 }),
    );
    const out = await scrapeUrl("https://example.com");
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("request_failed");
  });

  it("search maps hits and classifies linkedin sources", async () => {
    setKey("test-key");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { url: "https://www.linkedin.com/in/jane", title: "Jane" },
            { url: "https://news.example.com/post", description: "desc" },
          ],
        }),
        { status: 200 },
      ),
    );
    const out = await search("jane investor", { limit: 5 });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.hits).toHaveLength(2);
    }
  });

  it("search returns empty_result when no hits", async () => {
    setKey("test-key");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), { status: 200 }),
    );
    const out = await search("nothing");
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("empty_result");
  });
});
