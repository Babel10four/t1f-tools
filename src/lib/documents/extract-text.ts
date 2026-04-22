/**
 * Best-effort text extraction for text-based PDFs (no OCR).
 * Returns null on failure — upload may still succeed (CONTENT-001).
 */
export async function extractPdfTextBestEffort(
  buffer: Buffer,
): Promise<string | null> {
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    const text = result.text?.trim();
    return text && text.length > 0 ? text : null;
  } catch {
    return null;
  }
}
