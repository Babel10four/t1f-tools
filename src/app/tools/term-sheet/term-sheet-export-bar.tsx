"use client";

import { useCallback, useState } from "react";
import type { DealAnalyzeRequestV1 } from "@/lib/engines/deal/schemas/canonical-request";
import type { DealAnalyzeResponseV1 } from "@/lib/engines/deal/schemas/canonical-response";
import type { TermSheetLocalMetadata } from "./term-sheet-types";
import { buildTermSheetPlainText } from "./term-sheet-plain-text";
import { downloadTermSheetPdf } from "./term-sheet-pdf";

export function TermSheetExportBar({
  metadata,
  request,
  response,
}: {
  metadata: TermSheetLocalMetadata;
  request: DealAnalyzeRequestV1 | undefined;
  response: DealAnalyzeResponseV1;
}) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    const text = buildTermSheetPlainText(metadata, request, response);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.alert("Could not copy to clipboard. Select text manually or try HTTPS.");
    }
  }, [metadata, request, response]);

  const pdf = useCallback(() => {
    downloadTermSheetPdf(metadata, request, response);
  }, [metadata, request, response]);

  return (
    <div
      className="flex flex-wrap items-center gap-3 border-b border-zinc-200 py-4 dark:border-zinc-800"
      data-testid="ts-export-bar"
    >
      <button
        type="button"
        data-testid="ts-copy-summary"
        onClick={() => void copy()}
        className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
      >
        {copied ? "Copied" : "Copy terms summary"}
      </button>
      <button
        type="button"
        data-testid="ts-download-pdf"
        onClick={pdf}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Download PDF
      </button>
    </div>
  );
}
