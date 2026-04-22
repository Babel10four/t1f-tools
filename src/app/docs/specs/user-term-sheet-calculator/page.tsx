import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { DocsMarkdown } from "@/app/docs/_components/docs-markdown";

const SPEC_REL = path.join("docs", "specs", "USER-TERM-SHEET-CALCULATOR-DESIGN.md");

export const metadata = {
  title: "User Term Sheet Calculator (design)",
  description:
    "Architecture for loan-scoped term sheet calculator, analyze integration, PDF fidelity vs 115 Lilley, and analytics.",
};

export default async function UserTermSheetDesignPage() {
  const fullPath = path.join(process.cwd(), SPEC_REL);
  const source = await fs.readFile(fullPath, "utf8");

  return (
    <article>
      <p className="mb-6 text-sm text-[var(--text-muted)]">
        <Link href="/docs" className="text-[var(--brand)] hover:underline">
          ← All public docs
        </Link>
        {" · "}
        <a
          className="text-[var(--brand)] hover:underline"
          href="/docs/specs/user-term-sheet-calculator/raw"
        >
          Raw Markdown
        </a>
      </p>
      <DocsMarkdown source={source} />
    </article>
  );
}
