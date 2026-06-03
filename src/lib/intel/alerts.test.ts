import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CompetitorChange } from "@/lib/engines/intel/competitor";
import { isAlertEmailConfigured, sendCompetitorAlert } from "./alerts";

const KEY = "RESEND_API_KEY";

function setKey(value: string | undefined) {
  if (value === undefined) delete process.env[KEY];
  else process.env[KEY] = value;
}

const CHANGES: CompetitorChange[] = [
  { competitor: "Kiavi", field: "ltv", from: "80%", to: "85%" },
];

describe("sendCompetitorAlert", () => {
  let prevKey: string | undefined;

  beforeEach(() => {
    prevKey = process.env[KEY];
  });

  afterEach(() => {
    setKey(prevKey);
    vi.restoreAllMocks();
  });

  it("returns no_changes for an empty change list without calling fetch", async () => {
    setKey("test-key");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const out = await sendCompetitorAlert([], "June 3, 2026");
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("no_changes");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns not_configured when RESEND_API_KEY is unset", async () => {
    setKey("");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(isAlertEmailConfigured()).toBe(false);
    const out = await sendCompetitorAlert(CHANGES, "June 3, 2026");
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("not_configured");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends to the configured recipient on success", async () => {
    setKey("test-key");
    process.env.ALERT_EMAIL_TO = "babel@t1f.com";
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ id: "e1" }), { status: 200 }));
    const out = await sendCompetitorAlert(CHANGES, "June 3, 2026");
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.to).toBe("babel@t1f.com");
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("returns request_failed on non-2xx", async () => {
    setKey("test-key");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("bad", { status: 422 }),
    );
    const out = await sendCompetitorAlert(CHANGES, "June 3, 2026");
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("request_failed");
  });
});
