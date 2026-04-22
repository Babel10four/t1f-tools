import { handleEnginePost } from "@/lib/engines/http";
import { runDealStructure } from "@/lib/engines/deal/structure";

export async function POST(req: Request) {
  return handleEnginePost(req, runDealStructure, {
    eventType: "deal_analyze_run",
    toolKey: "loan_structuring",
    route: "/api/deal/structure",
  });
}
