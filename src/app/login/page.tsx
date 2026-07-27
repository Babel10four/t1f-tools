import type { Metadata } from "next";
import { Suspense } from "react";
import { T1fLogoMark } from "@/components/branding/t1f-logo-mark";
import { HUB_SYSTEM_NAME } from "@/lib/branding";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "App-level access (ACCESS-001)",
};

function LoginFormFallback() {
  return (
    <p className="text-sm text-zinc-500" role="status">
      Loading…
    </p>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-[var(--surface-page)] px-4 py-16">
      <div className="w-full max-w-md rounded-xl border border-[var(--border-subtle)] border-l-4 border-l-[var(--brand)] bg-[var(--surface-chrome)] p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <T1fLogoMark className="mb-5" size={44} />
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {HUB_SYSTEM_NAME}
        </h1>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          Sign in with the rep or admin password. Your browser keeps that workspace
          active for seven days.
        </p>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
          Use <strong>t1f.tools</strong> directly; Vercel preview addresses keep
          separate sessions.
        </p>
        <div className="mt-6">
          <Suspense fallback={<LoginFormFallback />}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
