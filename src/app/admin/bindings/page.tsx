import type { Metadata } from "next";
import { isActiveBindingType } from "@/lib/bindings/constants";
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
    initial = (await listToolBindings()).filter((binding) =>
      isActiveBindingType(binding.bindingType),
    );
  } catch {
    dbError = "Database unavailable — set DATABASE_URL and run migrations (including tool_context_bindings).";
  }
  return <BindingsManager initial={initial} dbError={dbError} />;
}
