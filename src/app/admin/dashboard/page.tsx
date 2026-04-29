import type { Metadata } from "next";
import { getDashboardKpis, parseDashboardWindowDays } from "@/lib/analytics/dashboard";
import { AdminDashboardView } from "./dashboard-view";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Admin dashboard (ANALYTICS-001)",
};

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminDashboardPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const raw = sp.window;
  const windowParam = Array.isArray(raw) ? raw[0] : raw;
  const windowDays = parseDashboardWindowDays(windowParam);
  const kpis = await getDashboardKpis({ windowDays });
  return <AdminDashboardView kpis={kpis} />;
}
