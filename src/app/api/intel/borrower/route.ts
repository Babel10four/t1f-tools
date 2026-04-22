import { handleEnginePost } from "@/lib/engines/http";
import { runIntelBorrower } from "@/lib/engines/intel/borrower";

export async function POST(req: Request) {
  return handleEnginePost(req, runIntelBorrower);
}
