import { desc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { intelPropertyDossiers } from "@/db/schema";
import { clientSafeDatabaseErrorMessage } from "@/lib/db/client-safe-error-message";
import { handleEnginePost, jsonError } from "@/lib/engines/http";
import { runPropertyDossier } from "@/lib/engines/property/dossier";

export async function POST(req: Request) {
  return handleEnginePost(req, runPropertyDossier, {
    eventType: "property_dossier_run",
    toolKey: "property_dossier",
    route: "/api/property/dossier",
  });
}

/** Recent property dossiers (most recent first) for the Property Intel tool history. */
export async function GET() {
  try {
    const rows = await getDb()
      .select({
        id: intelPropertyDossiers.id,
        address: intelPropertyDossiers.address,
        dossier: intelPropertyDossiers.dossier,
        sources: intelPropertyDossiers.sources,
        createdAt: intelPropertyDossiers.createdAt,
      })
      .from(intelPropertyDossiers)
      .orderBy(desc(intelPropertyDossiers.createdAt))
      .limit(20);
    return Response.json({ ok: true, dossiers: rows });
  } catch (e) {
    const raw = e instanceof Error ? e.message : "Internal error";
    return jsonError(clientSafeDatabaseErrorMessage(raw), 500, "INTERNAL");
  }
}
