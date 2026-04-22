import { enqueuePlatformEvent } from "@/lib/analytics/log-event";
import { readJson, jsonError } from "@/lib/engines/http";
import { runPropertyRural } from "@/lib/engines/property/rural";
import type { UnknownRecord } from "@/lib/engines/types";

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
      metadata: { httpStatus: 500, message: message.slice(0, 500) },
    });
    return jsonError(message, 500, "INTERNAL");
  }
}
