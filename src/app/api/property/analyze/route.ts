import { handleEnginePost } from "@/lib/engines/http";
import { runPropertyAnalyze } from "@/lib/engines/property/analyze";

export async function POST(req: Request) {
  return handleEnginePost(req, runPropertyAnalyze);
}
