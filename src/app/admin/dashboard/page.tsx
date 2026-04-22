import type { Metadata } from "next";
import { getDashboardKpis } from "@/lib/analytics/dashboard";
import { AdminDashboardView } from "./dashboard-view";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Admin dashboard (ANALYTICS-001)",
};

export default async function AdminDashboardPage() {
  const kpis = await getDashboardKpis();
  return <AdminDashboardView kpis={kpis} />;
}
