import type { Metadata } from "next";
import { listDocuments } from "@/lib/documents/service";
import { DocumentsManager } from "./documents-manager";

export const metadata: Metadata = {
  title: "Documents",
  description: "Admin document library (CONTENT-001)",
};

export const dynamic = "force-dynamic";

export default async function AdminDocumentsPage() {
  try {
    const initial = await listDocuments();
    return <DocumentsManager initial={initial} />;
  } catch (e) {
    const msg =
      e instanceof Error
        ? e.message
        : "Database unavailable. Set DATABASE_URL and apply drizzle/0001_documents.sql (see README).";
    return (
      <div className="flex flex-col gap-4" data-testid="admin-documents">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Documents
        </h1>
        <p className="text-sm text-red-700 dark:text-red-300" role="alert">
          {msg}
        </p>
      </div>
    );
  }
}
