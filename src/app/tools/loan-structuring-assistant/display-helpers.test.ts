import { describe, expect, it } from "vitest";
import type { AnalysisFlag, DealAnalyzeRiskV1 } from "@/lib/engines/deal/schemas/canonical-response";
import {
  formatMoneyWholeDollars,
  groupRisksBySeverity,
  sortAnalysisFlagsForDisplay,
} from "./display-helpers";

describe("sortAnalysisFlagsForDisplay", () => {
  it("places binding flags first (LTC then ARV), then preserves other flag order", () => {
    const flags: AnalysisFlag[] = [
      { code: "OTHER", severity: "info", message: "x" },
      { code: "PURCHASE_POLICY_MAX_BINDS_ARV", severity: "info", message: "a" },
      { code: "PURCHASE_POLICY_MAX_BINDS_LTC", severity: "info", message: "b" },
      { code: "Z", severity: "low", message: "z" },
    ];
    const sorted = sortAnalysisFlagsForDisplay(flags);
    expect(sorted.map((f) => f.code)).toEqual([
      "PURCHASE_POLICY_MAX_BINDS_LTC",
      "PURCHASE_POLICY_MAX_BINDS_ARV",
      "OTHER",
      "Z",
    ]);
  });
});

describe("formatMoneyWholeDollars", () => {
  it("rounds to nearest dollar and omits cents", () => {
    expect(formatMoneyWholeDollars(500_000)).toBe("$500,000");
    expect(formatMoneyWholeDollars(3281.25)).toBe("$3,281");
    expect(formatMoneyWholeDollars(3281.6)).toBe("$3,282");
  });

  it("matches formatMoney null handling", () => {
    expect(formatMoneyWholeDollars(null)).toBe("—");
    expect(formatMoneyWholeDollars(undefined)).toBe("—");
  });
});

describe("groupRisksBySeverity", () => {
  it("orders high before medium and preserves order within group", () => {
    const risks: DealAnalyzeRiskV1[] = [
      {
        code: "B",
        severity: "medium",
        title: "m2",
        detail: "d",
      },
      {
        code: "A",
        severity: "high",
        title: "h",
        detail: "d",
      },
    ];
    const g = groupRisksBySeverity(risks);
    expect(g.map((x) => x.severity)).toEqual(["high", "medium"]);
    expect(g[0]!.risks.map((r) => r.code)).toEqual(["A"]);
    expect(g[1]!.risks.map((r) => r.code)).toEqual(["B"]);
  });
});
