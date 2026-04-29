import type { Metadata } from "next";
import Link from "next/link";
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
          Sign in with the shared password for your role.
        </p>
        <aside
          className="mt-5 rounded-lg border border-[var(--border-subtle)] border-l-4 border-l-[var(--brand)] bg-[var(--surface-page)] p-4 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-300"
          aria-label="Rural screening after sign-in"
        >
          <p className="font-semibold text-zinc-900 dark:text-zinc-50">
            Rural screening lives on the Tool Hub
          </p>
          <p className="mt-2 leading-relaxed text-zinc-600 dark:text-zinc-400">
            Tier One–style rural evidence (tract density, OSM amenities, highway context,
            plus published rules) runs only after sign-in because address checks use
            secure server routes. Optional: use the checkbox below to open the rural
            panel as soon as you land on{" "}
            <span className="font-medium text-zinc-800 dark:text-zinc-200">/tools</span>
            .
          </p>
          <p className="mt-3">
            <Link
              href="/tools/rural-checker"
              className="inline-flex items-center gap-1 font-medium text-[var(--brand)] underline decoration-[var(--brand)] underline-offset-2 hover:text-[var(--brand-hover)]"
            >
              Open Rural Checker
              <span aria-hidden className="text-zinc-400 no-underline">
                →
              </span>
            </Link>
            <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-500">
              Requires sign-in; unauthenticated visits redirect back to this page.
            </span>
          </p>
        </aside>
        <div className="mt-6">
          <Suspense fallback={<LoginFormFallback />}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
