import { handleEnginePost } from "@/lib/engines/http";
import { runPropertyAnalyze } from "@/lib/engines/property/analyze";

export async function POST(req: Request) {
  return handleEnginePost(req, runPropertyAnalyze, {
    eventType: "property_analyze_run",
    toolKey: "property_analyzer",
    route: "/api/property/analyze",
  });
}
