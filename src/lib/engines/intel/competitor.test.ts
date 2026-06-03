import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as alertsMod from "@/lib/intel/alerts";
import * as extractMod from "@/lib/intel/extract";
import * as firecrawlMod from "@/lib/intel/firecrawl";
import * as dbMod from "@/db/client";
import type { CompetitorParsed } from "@/lib/intel/types";
import { runCompetitorSweep } from "./competitor";

vi.mock("@/lib/intel/firecrawl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/intel/firecrawl")>();
  return { ...actual, scrapeUrl: vi.fn() };
});
vi.mock("@/lib/intel/extract", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/intel/extract")>();
  return { ...actual, extractStructured: vi.fn(), isOpenAIConfigured: vi.fn() };
});
vi.mock("@/lib/intel/alerts", () => ({ sendCompetitorAlert: vi.fn() }));
vi.mock("@/db/client", () => ({ getDb: vi.fn() }));

/** Fake Drizzle db supporting select(...).limit() (previous snapshot) and insert(...).values(). */
function mockDb(prevParsed: CompetitorParsed | null) {
  const limit = vi.fn().mockResolvedValue(prevParsed ? [{ parsed: prevParsed }] : []);
  const orderBy = vi.fn().mockReturnValue({ limit });
  const where = vi.fn().mockReturnValue({ orderBy });
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });
  const values = vi.fn().mockResolvedValue(undefined);
  const insert = vi.fn().mockReturnValue({ values });
  vi.mocked(dbMod.getDb).mockReturnValue({ select, insert } as never);
  return { select, insert, values };
}

describe("runCompetitorSweep (INTEL-001)", () => {
  beforeEach(() => {
    vi.mocked(firecrawlMod.scrapeUrl).mockReset();
    vi.mocked(extractMod.extractStructured).mockReset();
    vi.mocked(extractMod.isOpenAIConfigured).mockReset();
    vi.mocked(alertsMod.sendCompetitorAlert).mockReset();
    vi.mocked(dbMod.getDb).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not attempt an alert when Firecrawl is unconfigured (no scans)", async () => {
    vi.mocked(firecrawlMod.scrapeUrl).mockResolvedValue({
      ok: false,
      reason: "not_configured",
      message: "no key",
    });
    vi.mocked(extractMod.isOpenAIConfigured).mockReturnValue(false);

    const out = await runCompetitorSweep();

    expect(out.scanned).toBe(0);
    expect(out.changes).toHaveLength(0);
    expect(out.alert.attempted).toBe(false);
    expect(out.degraded.firecrawl).toBe(true);
    expect(alertsMod.sendCompetitorAlert).not.toHaveBeenCalled();
  });

  it("detects changes vs prior snapshot and attempts an alert", async () => {
    vi.mocked(firecrawlMod.scrapeUrl).mockResolvedValue({
      ok: true,
      url: "https://example.com",
      markdown: "rates from 9.99%",
      title: "Comp",
    });
    vi.mocked(extractMod.isOpenAIConfigured).mockReturnValue(true);
    vi.mocked(extractMod.extractStructured).mockResolvedValue({
      ok: true,
      value: { ltv: "85%", rates: null, states: [], programs: [], fees: null },
    });
    mockDb({ ltv: "80%", rates: null, states: [], programs: [], fees: null });
    vi.mocked(alertsMod.sendCompetitorAlert).mockResolvedValue({
      ok: false,
      reason: "not_configured",
      message: "no key",
    });

    const out = await runCompetitorSweep();

    expect(out.changes.length).toBeGreaterThan(0);
    expect(out.changes[0]?.field).toBe("ltv");
    expect(out.alert.attempted).toBe(true);
    expect(out.alert.sent).toBe(false);
    expect(out.alert.reason).toBe("not_configured");
    expect(alertsMod.sendCompetitorAlert).toHaveBeenCalledOnce();
  });

  it("marks alert sent when delivery succeeds", async () => {
    vi.mocked(firecrawlMod.scrapeUrl).mockResolvedValue({
      ok: true,
      url: "https://example.com",
      markdown: "x",
      title: "Comp",
    });
    vi.mocked(extractMod.isOpenAIConfigured).mockReturnValue(true);
    vi.mocked(extractMod.extractStructured).mockResolvedValue({
      ok: true,
      value: { ltv: "90%", rates: null, states: [], programs: [], fees: null },
    });
    mockDb({ ltv: "80%", rates: null, states: [], programs: [], fees: null });
    vi.mocked(alertsMod.sendCompetitorAlert).mockResolvedValue({
      ok: true,
      sent: true,
      to: "babel@t1f.com",
    });

    const out = await runCompetitorSweep();

    expect(out.alert.attempted).toBe(true);
    expect(out.alert.sent).toBe(true);
  });
});
