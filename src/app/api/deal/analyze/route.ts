import { handleDealAnalyzePost } from "@/lib/engines/http";

export async function POST(req: Request) {
  return handleDealAnalyzePost(req);
}
