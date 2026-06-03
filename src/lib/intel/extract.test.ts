import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractStructured, isOpenAIConfigured } from "./extract";

const KEY = "OPENAI_API_KEY";

function setKey(value: string | undefined) {
  if (value === undefined) {
    delete process.env[KEY];
  } else {
    process.env[KEY] = value;
  }
}

function chatResponse(content: string) {
  return new Response(
    JSON.stringify({ choices: [{ message: { content } }] }),
    { status: 200 },
  );
}

describe("extractStructured", () => {
  let prevKey: string | undefined;

  beforeEach(() => {
    prevKey = process.env[KEY];
  });

  afterEach(() => {
    setKey(prevKey);
    vi.restoreAllMocks();
  });

  it("returns not_configured without calling fetch when key absent", async () => {
    setKey("");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(isOpenAIConfigured()).toBe(false);
    const out = await extractStructured("sys", "ctx", "{}");
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("not_configured");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("parses a JSON object response", async () => {
    setKey("test-key");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      chatResponse('{"summary":"ok","confidence":"high"}'),
    );
    const out = await extractStructured<{ summary: string }>("sys", "ctx", "{}");
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.value.summary).toBe("ok");
  });

  it("returns bad_response on non-JSON content", async () => {
    setKey("test-key");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(chatResponse("not json"));
    const out = await extractStructured("sys", "ctx", "{}");
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("bad_response");
  });

  it("returns bad_response when model returns a JSON array (not object)", async () => {
    setKey("test-key");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(chatResponse("[1,2,3]"));
    const out = await extractStructured("sys", "ctx", "{}");
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("bad_response");
  });

  it("returns request_failed on non-2xx", async () => {
    setKey("test-key");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("err", { status: 429 }),
    );
    const out = await extractStructured("sys", "ctx", "{}");
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("request_failed");
  });
});
