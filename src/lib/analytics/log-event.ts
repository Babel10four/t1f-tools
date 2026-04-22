import { getDb } from "@/db/client";
import { platformEvents } from "@/db/schema";
import { getSessionPayloadFromRequest } from "@/lib/auth/session-server";
import type { AnalyticsEventType, AnalyticsStatus } from "./constants";
import { ANALYTICS_METADATA_MAX_CHARS } from "./constants";

function truncateMetadata(
  meta: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!meta || Object.keys(meta).length === 0) {
    return {};
  }
  try {
    const s = JSON.stringify(meta);
    if (s.length <= ANALYTICS_METADATA_MAX_CHARS) {
      return meta;
    }
    return {
      _truncated: true,
      _preview: s.slice(0, ANALYTICS_METADATA_MAX_CHARS),
    };
  } catch {
    return { _error: "metadata_not_serializable" };
  }
}

export type LogPlatformEventInput = {
  req: Request;
  eventType: AnalyticsEventType;
  toolKey: string | null;
  route: string;
  status: AnalyticsStatus;
  metadata?: Record<string, unknown>;
};

/**
 * Persists one event. **Fire-and-forget** from API routes (`void logPlatformEvent(...)`);
 * failures are swallowed so tool usage is never blocked (ANALYTICS-001).
 */
export async function logPlatformEvent(input: LogPlatformEventInput): Promise<void> {
  try {
    const session = await getSessionPayloadFromRequest(input.req);
    const role = session?.role ?? "anonymous";
    const sessionId = session?.sid ?? "none";

    const db = getDb();
    await db.insert(platformEvents).values({
      eventType: input.eventType,
      toolKey: input.toolKey,
      role,
      sessionId,
      route: input.route,
      status: input.status,
      metadata: truncateMetadata(input.metadata),
    });
  } catch {
    // Intentionally silent — analytics must not break product flows.
  }
}

/**
 * Non-blocking wrapper for route handlers.
 */
export function enqueuePlatformEvent(input: LogPlatformEventInput): void {
  void logPlatformEvent(input).catch(() => {});
}
