import type { AnalysisFlag, DealAnalyzeRiskV1 } from "@/lib/engines/deal/schemas/canonical-response";

const BINDING_ORDER = [
  "PURCHASE_POLICY_MAX_BINDS_LTC",
  "PURCHASE_POLICY_MAX_BINDS_ARV",
] as const;

const BINDING_CODES = new Set<string>(BINDING_ORDER);

/**
 * Binding-leg flags first (LTC then ARV), then remaining flags in **original API order**
 * (stable relative order among non-binding).
 */
export function sortAnalysisFlagsForDisplay(flags: AnalysisFlag[]): AnalysisFlag[] {
  const ltc = flags.find((f) => f.code === "PURCHASE_POLICY_MAX_BINDS_LTC");
  const arv = flags.find((f) => f.code === "PURCHASE_POLICY_MAX_BINDS_ARV");
  const head = [ltc, arv].filter(Boolean) as AnalysisFlag[];
  const nonBinding = flags.filter((f) => !BINDING_CODES.has(f.code));
  return [...head, ...nonBinding];
}

const SEVERITY_ORDER: DealAnalyzeRiskV1["severity"][] = [
  "high",
  "medium",
  "low",
  "info",
];

export function groupRisksBySeverity(
  risks: DealAnalyzeRiskV1[],
): { severity: DealAnalyzeRiskV1["severity"]; risks: DealAnalyzeRiskV1[] }[] {
  const buckets = new Map<DealAnalyzeRiskV1["severity"], DealAnalyzeRiskV1[]>();
  for (const s of SEVERITY_ORDER) {
    buckets.set(s, []);
  }
  for (const r of risks) {
    const list = buckets.get(r.severity);
    if (list) {
      list.push(r);
    } else {
      buckets.set(r.severity, [r]);
    }
  }
  const out: { severity: DealAnalyzeRiskV1["severity"]; risks: DealAnalyzeRiskV1[] }[] =
    [];
  for (const s of SEVERITY_ORDER) {
    const list = buckets.get(s);
    if (list && list.length > 0) {
      out.push({ severity: s, risks: list });
    }
  }
  for (const [sev, list] of buckets) {
    if (!SEVERITY_ORDER.includes(sev) && list.length > 0) {
      out.push({ severity: sev, risks: list });
    }
  }
  return out;
}

export function formatMoney(n: number | null | undefined): string {
  if (n === null || n === undefined) {
    return "—";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

/** USD with no cents — term sheet PDF / export parity. */
export function formatMoneyWholeDollars(n: number | null | undefined): string {
  if (n === null || n === undefined) {
    return "—";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}
