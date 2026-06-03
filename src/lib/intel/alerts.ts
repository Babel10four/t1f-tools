/**
 * Intelligence Layer — alert delivery (INTEL-001).
 *
 * Sends Competitor Intelligence change alerts by email via the Resend REST API (raw `fetch`,
 * no SDK). Gated on `RESEND_API_KEY`: when missing we return `{ ok: false, reason:
 * "not_configured" }` instead of throwing, so the nightly sweep still succeeds and stores
 * snapshots even when email is not wired up.
 *
 * Env:
 * - RESEND_API_KEY     — Resend API key (required to actually send).
 * - ALERT_EMAIL_FROM   — verified sender, e.g. "Competitor Intel <alerts@t1f.com>"
 *                        (default "alerts@t1f.com"). The domain must be verified in Resend.
 * - ALERT_EMAIL_TO     — recipient (default "babel@t1f.com").
 */

import type { CompetitorChange } from "@/lib/engines/intel/competitor";

const DEFAULT_FROM = "alerts@t1f.com";
const DEFAULT_TO = "babel@t1f.com";

export type AlertResult =
  | { ok: true; sent: true; to: string }
  | { ok: false; reason: "not_configured" | "no_changes" | "request_failed"; message: string };

export function isAlertEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

function describeChange(c: CompetitorChange): string {
  return `${c.competitor}: ${c.field} changed from "${c.from}" to "${c.to}"`;
}

function renderText(changes: CompetitorChange[], detectedOn: string): string {
  const lines = changes.map((c) => `• ${describeChange(c)}`);
  return [
    `Competitor Intelligence detected ${changes.length} change(s) on ${detectedOn}:`,
    "",
    ...lines,
    "",
    "— t1f.tools nightly competitor sweep",
  ].join("\n");
}

function renderHtml(changes: CompetitorChange[], detectedOn: string): string {
  const items = changes
    .map((c) => `<li>${escapeHtml(describeChange(c))}</li>`)
    .join("");
  return [
    `<p>Competitor Intelligence detected <strong>${changes.length}</strong> change(s) on ${escapeHtml(detectedOn)}:</p>`,
    `<ul>${items}</ul>`,
    `<p style="color:#71717a;font-size:12px">— t1f.tools nightly competitor sweep</p>`,
  ].join("");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Send a competitor change alert email. No-ops (returns `no_changes`) when there is nothing to
 * report, and `not_configured` when RESEND_API_KEY is unset.
 */
export async function sendCompetitorAlert(
  changes: CompetitorChange[],
  detectedOn: string,
): Promise<AlertResult> {
  if (changes.length === 0) {
    return { ok: false, reason: "no_changes", message: "No changes to report" };
  }
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    return { ok: false, reason: "not_configured", message: "RESEND_API_KEY is not configured" };
  }
  const from = process.env.ALERT_EMAIL_FROM?.trim() || DEFAULT_FROM;
  const to = process.env.ALERT_EMAIL_TO?.trim() || DEFAULT_TO;
  const subject = `Competitor Intel: ${changes.length} change(s) detected ${detectedOn}`;

  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        text: renderText(changes, detectedOn),
        html: renderHtml(changes, detectedOn),
      }),
    });
  } catch (e) {
    return {
      ok: false,
      reason: "request_failed",
      message: e instanceof Error ? e.message : "Resend network error",
    };
  }
  if (!res.ok) {
    const errText = await res.text();
    return {
      ok: false,
      reason: "request_failed",
      message: `Resend request failed (${res.status}): ${errText.slice(0, 200)}`,
    };
  }
  return { ok: true, sent: true, to };
}
