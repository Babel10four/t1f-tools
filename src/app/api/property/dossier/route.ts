import { handleEnginePost } from "@/lib/engines/http";
import { runPropertyDossier } from "@/lib/engines/property/dossier";

export async function POST(req: Request) {
  return handleEnginePost(req, runPropertyDossier, {
    eventType: "property_dossier_run",
    toolKey: "property_dossier",
    route: "/api/property/dossier",
  });
}
