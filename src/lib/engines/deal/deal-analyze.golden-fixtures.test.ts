import { describe, expect, it } from "vitest";
import { handleDealAnalyzePost } from "@/lib/engines/http";

import purchaseSuccess from "../../../../tests/fixtures/deal-analyze.purchase.success.json";
import unsupportedVersion400 from "../../../../tests/fixtures/deal-analyze.unsupported-version.400.json";

async function postFixture(requestBody: unknown) {
  return handleDealAnalyzePost(
    new Request("http://localhost/api/deal/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    }),
  );
}

describe("deal-analyze golden fixtures", () => {
  it("deal-analyze.purchase.success.json matches handler output", async () => {
    const fixture = purchaseSuccess as {
      httpStatus: number;
      request: unknown;
      response: unknown;
    };
    const res = await postFixture(fixture.request);
    expect(res.status).toBe(fixture.httpStatus);
    await expect(res.json()).resolves.toEqual(fixture.response);
  });

  it("deal-analyze.unsupported-version.400.json matches handler output", async () => {
    const fixture = unsupportedVersion400 as {
      httpStatus: number;
      request: unknown;
      response: unknown;
    };
    const res = await postFixture(fixture.request);
    expect(res.status).toBe(fixture.httpStatus);
    await expect(res.json()).resolves.toEqual(fixture.response);
  });
});
