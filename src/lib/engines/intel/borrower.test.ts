import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as extractMod from "@/lib/intel/extract";
import * as firecrawlMod from "@/lib/intel/firecrawl";
import * as dbMod from "@/db/client";
import { runIntelBorrower } from "./borrower";

vi.mock("@/lib/intel/firecrawl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/intel/firecrawl")>();
  return { ...actual, scrapeUrl: vi.fn(), search: vi.fn() };
});

vi.mock("@/lib/intel/extract", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/intel/extract")>();
  return { ...actual, extractStructured: vi.fn(), isOpenAIConfigured: vi.fn() };
});

vi.mock("@/db/client", () => ({ getDb: vi.fn() }));

/** Mock the Drizzle insert().values().returning() chain used by the engine. */
function mockDbReturning(id: string | null) {
  const returning = vi.fn().mockResolvedValue(id ? [{ id }] : []);
  const values = vi.fn().mockReturnValue({ returning });
  const insert = vi.fn().mockReturnValue({ values });
  vi.mocked(dbMod.getDb).mockReturnValue({ insert } as never);
  return { insert, values, returning };
}

function mockDbThrows() {
  const insert = vi.fn().mockImplementation(() => {
    throw new Error("DATABASE_URL is not set");
  });
  vi.mocked(dbMod.getDb).mockReturnValue({ insert } as never);
}

describe("runIntelBorrower (INTEL-001)", () => {
  beforeEach(() => {
    vi.mocked(firecrawlMod.scrapeUrl).mockReset();
    vi.mocked(firecrawlMod.search).mockReset();
    vi.mocked(extractMod.extractStructured).mockReset();
    vi.mocked(extractMod.isOpenAIConfigured).mockReset();
    vi.mocked(dbMod.getDb).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws when borrowerName is missing", async () => {
    await expect(runIntelBorrower({})).rejects.toThrow(/borrowerName/);
  });

  it("gathers, summarizes, normalizes, and persists a snapshot (happy path)", async () => {
    vi.mocked(firecrawlMod.scrapeUrl).mockResolvedValue({
      ok: true,
      url: "https://summit.example",
      markdown: "We flip homes in Denver.",
      title: "Summit",
    });
    vi.mocked(firecrawlMod.search).mockResolvedValue({
      ok: true,
      query: "q",
      hits: [
        { url: "https://www.linkedin.com/in/jane", title: "Jane Investor" },
        { url: "https://news.example/post", description: "Denver flipper" },
      ],
    });
    vi.mocked(extractMod.isOpenAIConfigured).mockReturnValue(true);
    vi.mocked(extractMod.extractStructured).mockResolvedValue({
      ok: true,
      value: {
        summary: "Experienced Denver flipper.",
        experience: { estimatedFlips: 32, note: "Active since 2015" },
        primaryMarkets: ["Denver", "Colorado Springs"],
        likelyBuyBox: { low: 250000, high: 500000, note: "" },
        riskFlags: [],
        exitStrategyPatterns: ["fix-and-flip"],
        confidence: "high",
      },
    });
    const chain = mockDbReturning("row-123");

    const out = await runIntelBorrower({
      borrowerName: "Jane Investor",
      entityName: "Summit Capital Homes LLC",
      website: "https://summit.example",
    });

    expect(out.ok).toBe(true);
    expect(out.snapshot.experience.estimatedFlips).toBe(32);
    expect(out.snapshot.primaryMarkets).toEqual(["Denver", "Colorado Springs"]);
    expect(out.snapshot.confidence).toBe("high");
    expect(out.persistedId).toBe("row-123");
    expect(out.degraded).toEqual({ firecrawl: false, openai: false, db: false });
    // website + 2 search hits across both queries
    expect(out.sources.length).toBeGreaterThanOrEqual(3);
    expect(chain.values).toHaveBeenCalledOnce();
  });

  it("degrades to a low-confidence snapshot when Firecrawl + OpenAI are unconfigured", async () => {
    vi.mocked(firecrawlMod.scrapeUrl).mockResolvedValue({
      ok: false,
      reason: "not_configured",
      message: "no key",
    });
    vi.mocked(firecrawlMod.search).mockResolvedValue({
      ok: false,
      reason: "not_configured",
      message: "no key",
    });
    vi.mocked(extractMod.isOpenAIConfigured).mockReturnValue(false);
    mockDbReturning("row-1");

    const out = await runIntelBorrower({
      borrowerName: "Jane Investor",
      website: "https://summit.example",
    });

    expect(out.snapshot.confidence).toBe("low");
    expect(out.degraded.firecrawl).toBe(true);
    expect(out.degraded.openai).toBe(true);
    expect(extractMod.extractStructured).not.toHaveBeenCalled();
  });

  it("sets degraded.db and null persistedId when persistence fails", async () => {
    vi.mocked(firecrawlMod.search).mockResolvedValue({
      ok: false,
      reason: "not_configured",
      message: "no key",
    });
    vi.mocked(extractMod.isOpenAIConfigured).mockReturnValue(false);
    mockDbThrows();

    const out = await runIntelBorrower({ borrowerName: "Jane Investor" });

    expect(out.persistedId).toBeNull();
    expect(out.degraded.db).toBe(true);
    expect(out.notes.some((n) => /not persisted/i.test(n))).toBe(true);
  });
});
