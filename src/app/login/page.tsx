import type { Metadata } from "next";
import { Suspense } from "react";
import { HUB_BUILT_BY_LINE, HUB_SYSTEM_NAME } from "@/lib/branding";
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
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          {HUB_SYSTEM_NAME}
        </h1>
        <p className="mt-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">
          {HUB_BUILT_BY_LINE}
        </p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Sign in with the shared password for your role.
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
