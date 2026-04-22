import { handleEnginePost } from "@/lib/engines/http";
import { runPropertyValuation } from "@/lib/engines/property/valuation";

export async function POST(req: Request) {
  return handleEnginePost(req, runPropertyValuation);
}
