import { resolveToolBinding, toResolvedMeta } from "@/lib/bindings/resolve";
import {
  validateRulePayload,
  type RuralRulesPayload,
} from "@/lib/rule-sets/validate-payload";
import type { UnknownRecord } from "../types";
import { attachRuralEvidenceToResponse } from "./rural-evidence-report";
import { enrichRuralAddress } from "./rural-enrichment";
import {
  finalizeEvaluation,
  hasScreeningContext,
  insufficientInfoSparse,
  noConfigResponse,
} from "./rural-evaluate";
import type { PropertyRuralRequestV1, PropertyRuralResponseV1 } from "./rural-types";

export type PropertyRuralInput = UnknownRecord;

export type PropertyRuralOutput = PropertyRuralResponseV1;

function parseRequest(raw: UnknownRecord): PropertyRuralRequestV1 {
  const optString = (v: unknown): string | undefined => {
    if (typeof v !== "string") {
      return undefined;
    }
    const t = v.trim();
    return t === "" ? undefined : t;
  };
  const optBool = (v: unknown): boolean | undefined => {
    if (typeof v !== "boolean") {
      return undefined;
    }
    return v;
  };
  const optNum = (v: unknown): number | undefined => {
    if (typeof v !== "number" || !Number.isFinite(v)) {
      return undefined;
    }
    return v;
  };
  return {
    addressLabel: optString(raw.addressLabel),
    addressLine: optString(raw.addressLine),
    state: optString(raw.state),
    county: optString(raw.county),
    municipality: optString(raw.municipality),
    population: optNum(raw.population),
    isInMsa: optBool(raw.isInMsa),
    userProvidedRuralIndicator: optBool(raw.userProvidedRuralIndicator),
  };
}

/** Strip fields used only for HTTP / enrichment — not referenced by scoring. */
function forEvaluation(req: PropertyRuralRequestV1): PropertyRuralRequestV1 {
  const { addressLine: _a, ...rest } = req;
  return rest;
}

function mergeEnrichmentWarnings(
  res: PropertyRuralResponseV1,
  enrichment: PropertyRuralResponseV1["enrichment"],
): PropertyRuralResponseV1 {
  if (!enrichment?.warnings?.length) {
    return res;
  }
  return { ...res, warnings: [...res.warnings, ...enrichment.warnings] };
}

function ruleSetMetaFromBinding(
  resolved: Extract<
    Awaited<ReturnType<typeof resolveToolBinding>>,
    { state: "resolved"; kind: "rule_set" }
  >,
): PropertyRuralResponseV1["ruleSet"] {
  const m = toResolvedMeta(resolved);
  if (m.kind !== "rule_set") {
    return null;
  }
  return {
    id: m.id,
    versionLabel: m.versionLabel,
    ruleType: "rural_rules",
  };
}

function ruralPolicyMetaFromBinding(
  resolved: Extract<
    Awaited<ReturnType<typeof resolveToolBinding>>,
    { state: "resolved"; kind: "document" }
  >,
): PropertyRuralResponseV1["ruralPolicy"] {
  const m = toResolvedMeta(resolved);
  if (m.kind !== "document") {
    return null;
  }
  return {
    id: m.id,
    title: m.title,
    versionLabel: m.versionLabel,
  };
}

export async function runPropertyRural(
  input: UnknownRecord,
): Promise<PropertyRuralOutput> {
  const req = parseRequest(input);

  let merged: PropertyRuralRequestV1 = { ...req };
  let enrichment: PropertyRuralResponseV1["enrichment"] = null;
  if (req.addressLine?.trim()) {
    const out = await enrichRuralAddress(req.addressLine, req);
    merged = out.merged;
    enrichment = out.enrichment;
  }

  const policyDocResult = await resolveToolBinding(
    "rural_checker",
    "rural_policy_document",
  );
  let ruralPolicyMeta: PropertyRuralResponseV1["ruralPolicy"] = null;
  if (
    policyDocResult.state === "resolved" &&
    policyDocResult.kind === "document"
  ) {
    ruralPolicyMeta = ruralPolicyMetaFromBinding(policyDocResult);
  }

  const rulesResult = await resolveToolBinding(
    "rural_checker",
    "rural_rules_rule_set",
  );

  const addressAttempted = Boolean(req.addressLine?.trim());

  if (
    rulesResult.state !== "resolved" ||
    rulesResult.kind !== "rule_set"
  ) {
    if (!hasScreeningContext(merged)) {
      return attachRuralEvidenceToResponse(
        insufficientInfoSparse(null, ruralPolicyMeta, {
          alsoWarnMissingPublishedRules: true,
          enrichment,
          addressLookupFailed: addressAttempted,
        }),
      );
    }
    return attachRuralEvidenceToResponse(
      noConfigResponse(ruralPolicyMeta, { enrichment }),
    );
  }

  const ruleSetMeta = ruleSetMetaFromBinding(rulesResult);

  if (!hasScreeningContext(merged)) {
    return attachRuralEvidenceToResponse(
      insufficientInfoSparse(ruleSetMeta, ruralPolicyMeta, {
        enrichment,
        addressLookupFailed: addressAttempted,
      }),
    );
  }

  const rawPayload = rulesResult.ruleSet.jsonPayload;
  if (rawPayload === null || typeof rawPayload !== "object" || Array.isArray(rawPayload)) {
    throw new Error(
      "Published rural rules payload is missing or not a JSON object (admin must fix the published rule set).",
    );
  }

  const validated = validateRulePayload("rural_rules", rawPayload);
  if (!validated.ok) {
    throw new Error(
      `Published rural rules payload failed validation: ${validated.error}`,
    );
  }

  const ruralPayload = validated.payload as RuralRulesPayload;
  const evaluated = forEvaluation(merged);
  let out = finalizeEvaluation(
    evaluated,
    ruralPayload.evaluation,
    ruleSetMeta,
    ruralPolicyMeta,
    enrichment,
  );

  if (addressAttempted && enrichment?.countyPopulationEstimate && req.population === undefined) {
    out = {
      ...out,
      reasons: [
        ...out.reasons,
        "Population was taken from the latest published ACS county total for the matched county (when you left population blank).",
      ],
    };
  }
  if (
    addressAttempted &&
    req.isInMsa === undefined &&
    enrichment?.metropolitanAreaName
  ) {
    out = {
      ...out,
      reasons: [
        ...out.reasons,
        `Census CBSA: ${enrichment.metropolitanAreaName} — treated as in a metropolitan statistical area for MSA scoring.`,
      ],
    };
  } else if (
    addressAttempted &&
    req.isInMsa === undefined &&
    enrichment?.micropolitanAreaName &&
    !enrichment.metropolitanAreaName
  ) {
    out = {
      ...out,
      reasons: [
        ...out.reasons,
        `Census CBSA: ${enrichment.micropolitanAreaName} — micropolitan areas are not treated as MSAs for the MSA penalty; adjust manually if policy requires otherwise.`,
      ],
    };
  }

  return attachRuralEvidenceToResponse(
    mergeEnrichmentWarnings(out, enrichment),
  );
}
