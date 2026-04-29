import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));
import { AdminShell } from "./admin-shell";
import { ADMIN_PRIMARY_NAV } from "./admin-nav";
import type { DashboardKpis } from "@/lib/analytics/dashboard";
import { AdminDashboardView } from "./dashboard/dashboard-view";
import { DocumentsManager } from "./documents/documents-manager";
import { RulesManager } from "./rules/rules-manager";
import AdminPublishHistoryPage from "./publish-history/page";

afterEach(() => {
  cleanup();
});

describe("ADMIN_PRIMARY_NAV", () => {
  it("lists dashboard, documents, rules, publish-history", () => {
    expect(ADMIN_PRIMARY_NAV.map((x) => x.href)).toEqual([
      "/admin/dashboard",
      "/admin/documents",
      "/admin/rules",
      "/admin/bindings",
      "/admin/publish-history",
    ]);
  });
});

describe("AdminShell", () => {
  it("renders admin primary navigation links", () => {
    render(
      <AdminShell>
        <p>child</p>
      </AdminShell>,
    );
    const nav = screen.getByTestId("admin-primary-nav");
    expect(withinNav(nav, "Dashboard")).toHaveAttribute("href", "/admin/dashboard");
    expect(withinNav(nav, "Documents")).toHaveAttribute("href", "/admin/documents");
    expect(withinNav(nav, "Rule Sets & Rates")).toHaveAttribute(
      "href",
      "/admin/rules",
    );
    expect(withinNav(nav, "Tool bindings")).toHaveAttribute(
      "href",
      "/admin/bindings",
    );
    expect(withinNav(nav, "Publish History")).toHaveAttribute(
      "href",
      "/admin/publish-history",
    );
  });

  it("includes deal workbench tools nav", () => {
    render(
      <AdminShell>
        <p>child</p>
      </AdminShell>,
    );
    expect(
      screen.getByRole("navigation", { name: "Tool navigation" }),
    ).toBeInTheDocument();
  });
});

function withinNav(nav: HTMLElement, name: string) {
  const link = Array.from(nav.querySelectorAll("a")).find(
    (a) => a.textContent === name,
  );
  if (!link) {
    throw new Error(`Link ${name} not found`);
  }
  return link;
}

const MOCK_KPIS: DashboardKpis = {
  windowDays: 7,
  dbAvailable: true,
  totals: {
    loanStructuringAssistantRuns: 3,
    dealAnalyzerRuns: 1,
    pricingCheckRuns: 2,
    cashToCloseRuns: 1,
    ruralCheckRuns: 0,
    creditCopilotQuestions: 0,
    termSheetPreviewRuns: 2,
    termSheetTermsApiEvents: 0,
    documentUploads: 4,
    documentPublishes: 2,
    ruleSetUpdates: 1,
  },
  errorsInWindow: 0,
  toolUsageByDay: [{ day: "2026-04-10", count: 5 }],
  toolUsageByToolKey: [{ toolKey: "loan_structuring", count: 3 }],
  publishedDocumentCount: 2,
  publishedRuleSets: [
    { ruleType: "rates", versionLabel: "v1" },
  ],
  termSheetCollateralAddresses: [],
  cashToCloseCollateralAddresses: [],
  ruralCheckAddresses: [],
};

describe("admin placeholder pages", () => {
  it("dashboard renders KPI sections when DB is available", () => {
    render(<AdminDashboardView kpis={MOCK_KPIS} />);
    expect(screen.getByTestId("admin-dashboard")).toBeInTheDocument();
    expect(screen.getByText(/Tool & API activity/i)).toBeInTheDocument();
    expect(screen.getByTestId("tool-usage-by-day")).toBeInTheDocument();
  });

  it("dashboard explains missing DB when unavailable", () => {
    render(
      <AdminDashboardView kpis={{ ...MOCK_KPIS, dbAvailable: false }} />,
    );
    expect(screen.getByTestId("admin-dashboard-db-unavailable")).toBeInTheDocument();
  });

  it("documents, rules, publish-history render", () => {
    render(<DocumentsManager initial={[]} />);
    expect(screen.getByTestId("admin-documents")).toBeInTheDocument();
    cleanup();
    render(<RulesManager initial={[]} />);
    expect(screen.getByTestId("admin-rules")).toBeInTheDocument();
    cleanup();
    render(<AdminPublishHistoryPage />);
    expect(screen.getByTestId("admin-publish-history")).toBeInTheDocument();
  });
});
