import { handleEnginePost } from "@/lib/engines/http";
import { runVoiceSession } from "@/lib/engines/voice/session";

export async function POST(req: Request) {
  return handleEnginePost(req, runVoiceSession, {
    eventType: "voice_session_run",
    toolKey: "voice_operator",
    route: "/api/voice/session",
  });
}
