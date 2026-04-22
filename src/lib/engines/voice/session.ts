import type { UnknownRecord } from "../types";

export type VoiceSessionInput = UnknownRecord;

export type VoiceSessionOutput = {
  ok: true;
  engine: "voice.session";
};

export async function runVoiceSession(
  _input: VoiceSessionInput,
): Promise<VoiceSessionOutput> {
  return { ok: true, engine: "voice.session" };
}
