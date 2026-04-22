import fs from "node:fs";
import path from "node:path";
import Link from "next/link";

function listTsExampleFiles(): string[] {
  const dir = path.join(process.cwd(), "docs", "TS Example");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => fs.statSync(path.join(dir, name)).isFile())
    .sort((a, b) => {
      if (a === "README.md") return -1;
      if (b === "README.md") return 1;
      if (a.endsWith(".pdf")) return -1;
      if (b.endsWith(".pdf")) return 1;
      return a.localeCompare(b);
    });
}

function labelForTsExampleFile(file: string): string {
  if (file === "README.md") return "TS Example README";
  if (file.endsWith(".pdf")) return "115 Lilley PDF (golden master)";
  if (file.startsWith("Screenshot")) return "Calculator screenshot";
  return file;
}

export default function DocsIndexPage() {
  const tsExampleFiles = listTsExampleFiles();
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Public documentation</h1>
        <p className="mt-2 max-w-2xl text-[var(--text-muted)]">
          Specifications and design references published on the same site as the tools hub. No
          login required for these pages.
        </p>
      </div>

      <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-chrome)] p-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Specifications</h2>
        <ul className="mt-4 list-inside list-disc space-y-2 text-[var(--text-primary)]">
          <li>
            <Link
              href="/docs/specs/user-term-sheet-calculator"
              className="font-medium text-[var(--brand)] hover:underline"
            >
              User-view Term Sheet Calculator + PDF
            </Link>
            <span className="text-[var(--text-muted)]"> — design spec (readable + raw)</span>
          </li>
        </ul>
      </section>

      <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-chrome)] p-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">TS Example (golden refs)</h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Static copies from the repo, synced at build time to{" "}
          <code className="rounded bg-[var(--brand-muted)] px-1 py-0.5 font-mono text-xs">
            /docs/ts-example/
          </code>
          .
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          {tsExampleFiles.length === 0 ? (
            <li className="text-[var(--text-muted)]">No files found under docs/TS Example.</li>
          ) : (
            tsExampleFiles.map((file) => (
              <li key={file}>
                <a
                  className="text-[var(--brand)] hover:underline"
                  href={`/docs/ts-example/${encodeURIComponent(file)}`}
                >
                  {labelForTsExampleFile(file)}
                </a>
                <span className="ml-2 font-mono text-xs text-[var(--text-muted)]">{file}</span>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
