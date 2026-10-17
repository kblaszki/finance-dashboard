import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";
import { STORAGE_KEY, ThemeProvider } from "../state/theme";

vi.mock("../state/auth", () => ({
  useAuth: () => ({
    user: {
      id: 1,
      email: "demo@finance.local",
      username: "demo",
    },
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }),
}));

vi.mock("../api/accountsApi", () => ({
  fetchAccounts: vi.fn().mockResolvedValue([]),
}));

function renderShell(path = "/dashboard") {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<p>Dashboard body</p>} />
            <Route path="/accounts" element={<p>Accounts body</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("AppShell drawer", () => {
  beforeEach(() => {
    cleanup();
    document.body.style.overflow = "";
    localStorage.setItem(STORAGE_KEY, "light");
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  });

  it("toggles the sidebar open class from the menu button", () => {
    renderShell();
    const menu = screen.getByRole("button", { name: "Open menu" });
    const sidebar = document.getElementById("shell-sidebar");
    expect(sidebar?.classList.contains("shell-sidebar--open")).toBe(false);
    expect(menu.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(menu);
    expect(sidebar?.classList.contains("shell-sidebar--open")).toBe(true);
    const closeToggle = screen.getByRole("button", {
      name: "Close menu",
      expanded: true,
    });
    expect(closeToggle.getAttribute("aria-controls")).toBe("shell-sidebar");

    fireEvent.click(closeToggle);
    expect(sidebar?.classList.contains("shell-sidebar--open")).toBe(false);
  });

  it("closes on Escape and on navigation", () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(
      document.getElementById("shell-sidebar")?.classList.contains("shell-sidebar--open"),
    ).toBe(true);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(
      document.getElementById("shell-sidebar")?.classList.contains("shell-sidebar--open"),
    ).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    fireEvent.click(screen.getByRole("link", { name: "Accounts" }));
    expect(
      document.getElementById("shell-sidebar")?.classList.contains("shell-sidebar--open"),
    ).toBe(false);
    expect(screen.getByText("Accounts body")).toBeTruthy();
  });

  it("closes when the backdrop is clicked", () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const backdrop = document.querySelector(".shell-backdrop");
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);
    expect(
      document.getElementById("shell-sidebar")?.classList.contains("shell-sidebar--open"),
    ).toBe(false);
  });
});
