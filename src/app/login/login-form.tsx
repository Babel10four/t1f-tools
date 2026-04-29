"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { RURAL_HUB_EXPAND_SESSION_KEY } from "@/lib/tools/rural-hub-session";

const DEFAULT_NEXT = "/tools";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextRaw = searchParams.get("next");
  const nextIsSafe =
    nextRaw &&
    nextRaw.startsWith("/") &&
    !nextRaw.startsWith("//");

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [openRuralOnHub, setOpenRuralOnHub] = useState(false);
  const ruralOptId = useId();

  return (
    <form
      className="flex w-full max-w-sm flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setPending(true);
        const fd = new FormData(e.currentTarget);
        const password = fd.get("password");
        if (typeof password !== "string") {
          setError("Invalid credentials");
          setPending(false);
          return;
        }
        try {
          const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password }),
          });
          if (!res.ok) {
            setError("Invalid credentials");
            setPending(false);
            return;
          }
          if (openRuralOnHub && typeof window !== "undefined") {
            try {
              window.sessionStorage.setItem(RURAL_HUB_EXPAND_SESSION_KEY, "1");
            } catch {
              // ignore quota / private mode
            }
          }
          const data = (await res.json()) as { defaultPath?: string };
          const serverDefault =
            typeof data.defaultPath === "string" &&
            data.defaultPath.startsWith("/") &&
            !data.defaultPath.startsWith("//")
              ? data.defaultPath
              : DEFAULT_NEXT;
          const destination = nextIsSafe ? nextRaw! : serverDefault;
          router.replace(destination);
          router.refresh();
        } catch {
          setError("Invalid credentials");
          setPending(false);
        }
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-800 dark:text-zinc-200">
          Password
        </span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={pending}
          data-testid="login-password"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
      </label>
      <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/50">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Rural property screening
        </p>
        <p className="mt-1.5 text-sm leading-snug text-zinc-700 dark:text-zinc-300">
          After you sign in, you can run the same rural check as the full tool: Census
          tract/block-group density, service distances from OpenStreetMap, and a
          criterion-by-criterion evidence report — outcomes such as{" "}
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            Likely Rural / Out of Policy
          </span>{" "}
          or{" "}
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            Manual UW Review Required
          </span>
          . Screening uses authenticated APIs only (not on this page).
        </p>
        <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-zinc-800 dark:text-zinc-200">
          <input
            id={ruralOptId}
            type="checkbox"
            checked={openRuralOnHub}
            onChange={(e) => setOpenRuralOnHub(e.target.checked)}
            disabled={pending}
            className="mt-0.5"
            data-testid="login-open-rural-on-hub"
          />
          <span>
            After sign-in, expand{" "}
            <span className="font-medium">rural screening</span> on the Tool Hub
            automatically (this browser tab only; closing the tab clears it).
          </span>
        </label>
      </div>
      {error ? (
        <p className="text-sm text-red-700 dark:text-red-300" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        data-testid="login-submit"
        className="rounded-lg bg-[var(--brand)] px-4 py-2.5 text-sm font-medium text-[var(--brand-foreground)] shadow-sm transition-colors hover:bg-[var(--brand-hover)] disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
