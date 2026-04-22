import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const PREFIX_BLOB = "blob:";
const PREFIX_LOCAL = "local:";

function localRoot(): string {
  return process.env.LOCAL_DOCUMENT_ROOT ?? join(process.cwd(), ".local-documents");
}

/**
 * Upload PDF bytes — Vercel Blob (private) when `BLOB_READ_WRITE_TOKEN` is set,
 * else local filesystem under `.local-documents/` (dev / tests).
 */
export async function putPdfBytes(
  documentId: string,
  buffer: Buffer,
): Promise<{ storageKey: string }> {
  const pathname = `documents/${documentId}.pdf`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    await put(pathname, buffer, {
      access: "private",
      contentType: "application/pdf",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return { storageKey: `${PREFIX_BLOB}${pathname}` };
  }

  const dir = localRoot();
  await mkdir(dir, { recursive: true });
  const fileName = `${documentId}.pdf`;
  const fullPath = join(dir, fileName);
  await writeFile(fullPath, buffer);
  return { storageKey: `${PREFIX_LOCAL}${fileName}` };
}

export async function readPdfBytes(storageKey: string): Promise<Buffer> {
  if (storageKey.startsWith(PREFIX_BLOB)) {
    const pathname = storageKey.slice(PREFIX_BLOB.length);
    const { get } = await import("@vercel/blob");
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      throw new Error("BLOB_READ_WRITE_TOKEN required to read blob storage");
    }
    const result = await get(pathname, { access: "private", token });
    if (!result || result.statusCode !== 200 || !result.stream) {
      throw new Error("Blob not found");
    }
    const chunks: Uint8Array[] = [];
    const reader = result.stream.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value) {
        chunks.push(value);
      }
    }
    return Buffer.concat(chunks);
  }

  if (storageKey.startsWith(PREFIX_LOCAL)) {
    const fileName = storageKey.slice(PREFIX_LOCAL.length);
    return readFile(join(localRoot(), fileName));
  }

  throw new Error("Unknown storage_key format");
}
