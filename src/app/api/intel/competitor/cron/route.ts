import { enqueuePlatformEvent } from "@/lib/analytics/log-event";
import { runCompetitorSweep } from "@/lib/engines/intel/competitor";
import { jsonError } from "@/lib/engines/http";

const ROUTE = "/api/intel/competitor/cron";

/**
 * Nightly Competitor Intelligence sweep (INTEL-001). Invoked by Vercel Cron (see vercel.json).
 * Optionally guarded by CRON_SECRET: when set, requires `Authorization: Bearer <CRON_SECRET>`
 * (Vercel Cron sends this automatically). Alert delivery (email/Slack) is deferred — detected
 * changes are returned and stored for in-app surfacing.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return jsonError("Unauthorized", 401, "UNAUTHORIZED");
    }
  }

  try {
    const result = await runCompetitorSweep();
    enqueuePlatformEvent({
      req,
      eventType: "intel_competitor_sweep",
      toolKey: "competitor_intel",
      route: ROUTE,
      status: "success",
      metadata: {
        scanned: result.scanned,
        stored: result.stored,
        changeCount: result.changes.length,
        alert: result.alert,
        degraded: result.degraded,
      },
    });
    return Response.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    enqueuePlatformEvent({
      req,
      eventType: "intel_competitor_sweep",
      toolKey: "competitor_intel",
      route: ROUTE,
      status: "error",
      metadata: { httpStatus: 500 },
    });
    return jsonError(message, 500, "INTERNAL");
  }
}
