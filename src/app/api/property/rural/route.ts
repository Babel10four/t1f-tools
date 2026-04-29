import { enqueuePlatformEvent } from "@/lib/analytics/log-event";
import { readJson, jsonError } from "@/lib/engines/http";
import { runPropertyRural } from "@/lib/engines/property/rural";
import type { UnknownRecord } from "@/lib/engines/types";

const MAX_RURAL_ADDRESS_LOG_CHARS = 500;

function ruralAddressSnippet(body: UnknownRecord): string | undefined {
  const raw = body.addressLine;
  if (typeof raw !== "string") {
    return undefined;
  }
  const t = raw.trim();
  if (t === "") {
    return undefined;
  }
  return t.slice(0, MAX_RURAL_ADDRESS_LOG_CHARS);
}

export async function POST(req: Request) {
  let body: UnknownRecord;
  try {
    body = (await readJson(req)) ?? {};
  } catch {
    enqueuePlatformEvent({
      req,
      eventType: "rural_check_run",
      toolKey: "rural_checker",
      route: "/api/property/rural",
      status: "error",
      metadata: { reason: "invalid_json", httpStatus: 400 },
    });
    return jsonError("Invalid JSON body", 400, "INVALID_JSON");
  }
  const addressLine = ruralAddressSnippet(body);
  try {
    const result = await runPropertyRural(body);
    enqueuePlatformEvent({
      req,
      eventType: "rural_check_run",
      toolKey: "rural_checker",
      route: "/api/property/rural",
      status: "success",
      metadata: {
        httpStatus: 200,
        result: result.result,
        hasRuleSet: result.ruleSet !== null,
        ...(addressLine ? { addressLine } : {}),
      },
    });
    return Response.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    enqueuePlatformEvent({
      req,
      eventType: "rural_check_run",
      toolKey: "rural_checker",
      route: "/api/property/rural",
      status: "error",
      metadata: {
        httpStatus: 500,
        message: message.slice(0, 500),
        ...(addressLine ? { addressLine } : {}),
      },
    });
    return jsonError(message, 500, "INTERNAL");
  }
}
