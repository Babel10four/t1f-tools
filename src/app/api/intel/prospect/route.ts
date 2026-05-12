import { handleEnginePost } from "@/lib/engines/http";
import { runIntelProspect } from "@/lib/engines/intel/prospect";

export async function POST(req: Request) {
  return handleEnginePost(req, runIntelProspect, {
    eventType: "intel_prospect_run",
    toolKey: "prospect_intel",
    route: "/api/intel/prospect",
  });
}
