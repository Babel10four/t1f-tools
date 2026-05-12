import { handleEnginePost } from "@/lib/engines/http";
import { runPropertyValuation } from "@/lib/engines/property/valuation";

export async function POST(req: Request) {
  return handleEnginePost(req, runPropertyValuation, {
    eventType: "property_valuation_run",
    toolKey: "property_valuation",
    route: "/api/property/valuation",
  });
}
