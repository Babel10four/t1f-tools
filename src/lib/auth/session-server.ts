import { cookies } from "next/headers";
import {
  authCookieName,
  verifySessionToken,
  type SessionPayload,
} from "@/lib/auth/session-token";

export async function getSessionPayload(): Promise<SessionPayload | null> {
  const jar = await cookies();
  return verifySessionToken(jar.get(authCookieName())?.value);
}

/**
 * Route handlers: read session JWT from `Cookie` header (opaque `sid` + `role`).
 */
export async function getSessionPayloadFromRequest(
  req: Request,
): Promise<SessionPayload | null> {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) {
    return null;
  }
  const name = authCookieName();
  const parts = cookieHeader.split(";").map((s) => s.trim());
  for (const p of parts) {
    if (p.startsWith(`${name}=`)) {
      const value = decodeURIComponent(p.slice(name.length + 1));
      return verifySessionToken(value);
    }
  }
  return null;
}
