import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "./SettingsPage";

vi.mock("../api/appConfigApi", () => ({
  fetchAppConfig: vi.fn(),
  updateAppConfig: vi.fn(),
}));

vi.mock("../api/authApi", () => ({
  updateEmail: vi.fn(),
  updatePassword: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock("../state/auth", () => ({
  useAuth: () => ({
    user: {
      id: 1,
      email: "demo@finance.local",
      username: "demo",
    },
    refreshUser: vi.fn(),
  }),
}));

vi.mock("../state/theme", () => ({
  useTheme: () => ({
    theme: "light" as const,
    setTheme: vi.fn(),
  }),
}));

import { fetchAppConfig, updateAppConfig } from "../api/appConfigApi";

function renderSettings() {
  return render(
    <MemoryRouter initialEntries={["/settings"]}>
      <Routes>
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("SettingsPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.mocked(fetchAppConfig).mockResolvedValue({ marketLiveApi: false });
    vi.mocked(updateAppConfig).mockResolvedValue({ marketLiveApi: true });
  });

  it("toggles marketLiveApi via app config", async () => {
    renderSettings();

    const checkbox = (await screen.findByRole("checkbox", {
      name: /allow live market api fetches/i,
    })) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(updateAppConfig).toHaveBeenCalledWith({ marketLiveApi: true });
    });
  });
});
