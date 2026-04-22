"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

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
      {error ? (
        <p className="text-sm text-red-700 dark:text-red-300" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        data-testid="login-submit"
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
