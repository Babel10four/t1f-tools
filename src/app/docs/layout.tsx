import type { Metadata } from "next";
import Link from "next/link";
import { HUB_SYSTEM_NAME } from "@/lib/branding";
import "./docs.css";

export const metadata: Metadata = {
  title: "Public docs",
  description: "Published specifications and design references for T1F Tools.",
  robots: { index: true, follow: true },
};

export default function DocsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-full bg-[var(--surface-page)]">
      <header className="border-b border-[var(--border-subtle)] bg-[var(--surface-chrome)]">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
              Public
            </span>
            <Link
              href="/docs"
              className="text-lg font-semibold text-[var(--text-primary)] hover:underline"
            >
              {HUB_SYSTEM_NAME} docs
            </Link>
          </div>
          <nav className="flex flex-wrap items-center gap-4 text-sm">
            <Link
              href="/docs/specs/user-term-sheet-calculator"
              className="text-[var(--brand)] hover:underline"
            >
              Term sheet (design)
            </Link>
            <Link href="/login?next=/tools" className="text-[var(--text-muted)] hover:underline">
              Internal tools (login)
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
      <footer className="mx-auto max-w-4xl border-t border-[var(--border-subtle)] px-4 py-6 text-center text-xs text-[var(--text-muted)]">
        Served from the same deployment as{" "}
        <span className="font-mono text-[var(--text-primary)]">t1f.tools</span> when the custom
        domain is attached in Vercel (Project → Settings → Domains).
      </footer>
    </div>
  );
}
