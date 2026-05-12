import { handleEnginePost } from "@/lib/engines/http";
import { runIntelMarket } from "@/lib/engines/intel/market";

export async function POST(req: Request) {
  return handleEnginePost(req, runIntelMarket, {
    eventType: "intel_market_run",
    toolKey: "market_intel",
    route: "/api/intel/market",
  });
}
