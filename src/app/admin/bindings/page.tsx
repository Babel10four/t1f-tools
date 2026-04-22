import type { Metadata } from "next";
import { listToolBindings } from "@/lib/bindings/service";
import { BindingsManager } from "./bindings-manager";

export const metadata: Metadata = {
  title: "Tool bindings",
  description: "CONTENT-002 — tool context bindings",
};

export const dynamic = "force-dynamic";

export default async function AdminBindingsPage() {
  let initial: Awaited<ReturnType<typeof listToolBindings>> = [];
  let dbError: string | null = null;
  try {
    initial = await listToolBindings();
  } catch {
    dbError = "Database unavailable — set DATABASE_URL and run migrations (including tool_context_bindings).";
  }
  return <BindingsManager initial={initial} dbError={dbError} />;
}
