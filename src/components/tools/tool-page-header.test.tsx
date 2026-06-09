// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ToolRoleProvider } from "@/app/tools/tool-role-context";
import { ToolPageHeader } from "@/components/tools/tool-page-header";
import type { AuthRole } from "@/lib/auth/constants";

afterEach(() => {
  cleanup();
});

function renderHeader(href: string, role: AuthRole) {
  return render(
    <ToolRoleProvider role={role}>
      <ToolPageHeader href={href} />
    </ToolRoleProvider>,
  );
}

describe("ToolPageHeader", () => {
  it("renders title, status badge, goal, inputs, and output", () => {
    renderHeader("/tools/term-sheet", "user");
    expect(
      screen.getByRole("heading", { level: 1, name: "Deal Sheet Builder" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByText("Inputs")).toBeInTheDocument();
    expect(screen.getByText("Output")).toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();
  });

  it("hides admin-only Next handoffs for users", () => {
    const { container } = renderHeader("/tools/term-sheet", "user");
    const links = within(container).queryAllByRole("link");
    const hrefs = links.map((l) => l.getAttribute("href"));
    expect(hrefs).not.toContain("/tools/cash-to-close-estimator");
    expect(hrefs).toContain("/tools/email-templates");
  });

  it("shows admin-only Next handoffs for admins", () => {
    const { container } = renderHeader("/tools/term-sheet", "admin");
    const links = within(container).queryAllByRole("link");
    const hrefs = links.map((l) => l.getAttribute("href"));
    expect(hrefs).toContain("/tools/cash-to-close-estimator");
  });

  it("renders a prototype badge for intel tools", () => {
    renderHeader("/tools/borrower-intel", "user");
    expect(screen.getByText("Prototype")).toBeInTheDocument();
  });
});
