"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import type { DealAnalyzeRequestV1 } from "@/lib/engines/deal/schemas/canonical-request";
import type { DealAnalyzeResponseV1 } from "@/lib/engines/deal/schemas/canonical-response";
import type { TermSheetLocalMetadata } from "./term-sheet-types";
import { buildTermSheetPlainText } from "./term-sheet-plain-text";
import { downloadTermSheetPdf } from "./term-sheet-pdf";

export function TermSheetExportBar({
  metadata,
  request,
  response,
  closingDate,
}: {
  metadata: TermSheetLocalMetadata;
  request: DealAnalyzeRequestV1 | undefined;
  response: DealAnalyzeResponseV1;
  /** User-selected closing date (`YYYY-MM-DD`) for cash-to-close per-diem interest. */
  closingDate?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    const text = buildTermSheetPlainText(metadata, request, response, closingDate);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.alert("Could not copy to clipboard. Select text manually or try HTTPS.");
    }
  }, [metadata, request, response, closingDate]);

  const pdf = useCallback(() => {
    void downloadTermSheetPdf(metadata, request, response, closingDate);
  }, [metadata, request, response, closingDate]);

  return (
    <div
      className="flex flex-wrap items-center gap-3 border-b border-zinc-200 py-4 dark:border-zinc-800"
      data-testid="ts-export-bar"
    >
      <Button
        variant="secondary"
        data-testid="ts-copy-summary"
        onClick={() => void copy()}
      >
        {copied ? "Copied" : "Copy terms summary"}
      </Button>
      <Button type="button" data-testid="ts-download-pdf" onClick={pdf}>
        Download PDF
      </Button>
    </div>
  );
}
