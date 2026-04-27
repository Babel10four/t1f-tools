// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LogoutButton } from "./logout-button";

const routerMock = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: routerMock.replace,
    refresh: routerMock.refresh,
  }),
}));

beforeEach(() => {
  routerMock.replace.mockClear();
  routerMock.refresh.mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("LogoutButton", () => {
  it("posts to the logout API before replacing the route", async () => {
    let resolveLogout: (value: Response) => void = () => {};
    const fetchMock = vi.fn(() => {
      return new Promise<Response>((resolve) => {
        resolveLogout = resolve;
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<LogoutButton className="logout-class">Log out</LogoutButton>);

    const button = screen.getByRole("button", { name: "Log out" });
    expect(button).toHaveClass("logout-class");

    await userEvent.click(button);

    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Logging out…");
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });

    resolveLogout(new Response(null, { status: 200 }));

    await waitFor(() => {
      expect(routerMock.replace).toHaveBeenCalledWith("/login");
    });
    expect(routerMock.refresh).toHaveBeenCalledOnce();
  });
});
