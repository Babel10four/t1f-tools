import { handleEnginePost } from "@/lib/engines/http";
import { runDealTerms } from "@/lib/engines/deal/terms";

export async function POST(req: Request) {
  return handleEnginePost(req, runDealTerms, {
    eventType: "term_sheet_generated",
    toolKey: "term_sheet",
    route: "/api/deal/terms",
  });
}
