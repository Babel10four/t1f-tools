import { desc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { intelBorrowerSnapshots } from "@/db/schema";
import { clientSafeDatabaseErrorMessage } from "@/lib/db/client-safe-error-message";
import { handleEnginePost, jsonError } from "@/lib/engines/http";
import { runIntelBorrower } from "@/lib/engines/intel/borrower";

export async function POST(req: Request) {
  return handleEnginePost(req, runIntelBorrower, {
    eventType: "intel_borrower_run",
    toolKey: "borrower_intel",
    route: "/api/intel/borrower",
  });
}

/** Recent borrower snapshots (most recent first) for the Borrower Intel tool history. */
export async function GET() {
  try {
    const rows = await getDb()
      .select({
        id: intelBorrowerSnapshots.id,
        borrowerName: intelBorrowerSnapshots.borrowerName,
        entityName: intelBorrowerSnapshots.entityName,
        website: intelBorrowerSnapshots.website,
        snapshot: intelBorrowerSnapshots.snapshot,
        sources: intelBorrowerSnapshots.sources,
        createdAt: intelBorrowerSnapshots.createdAt,
      })
      .from(intelBorrowerSnapshots)
      .orderBy(desc(intelBorrowerSnapshots.createdAt))
      .limit(20);
    return Response.json({ ok: true, snapshots: rows });
  } catch (e) {
    const raw = e instanceof Error ? e.message : "Internal error";
    return jsonError(clientSafeDatabaseErrorMessage(raw), 500, "INTERNAL");
  }
}
