import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const components: Components = {
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
      <table className="min-w-full border-collapse text-sm">{children}</table>
    </div>
  ),
};

type Props = {
  source: string;
};

export function DocsMarkdown({ source }: Props) {
  return (
    <div className="docs-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
