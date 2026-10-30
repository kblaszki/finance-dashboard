import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardPage } from "./DashboardPage";
import { CurrencyProvider } from "../state/currency";

vi.mock("../api/accountsApi", () => ({
  fetchAccounts: vi.fn(),
}));

vi.mock("../api/categoriesApi", () => ({
  fetchCategories: vi.fn(),
}));

vi.mock("../api/transfersApi", () => ({
  fetchTransfers: vi.fn(),
}));

vi.mock("../api/statisticsApi", () => ({
  fetchNetWorth: vi.fn(),
  fetchNetWorthHistory: vi.fn(),
  fetchPeriodSummary: vi.fn(),
}));

import { fetchAccounts } from "../api/accountsApi";
import { fetchCategories } from "../api/categoriesApi";
import {
  fetchNetWorth,
  fetchNetWorthHistory,
  fetchPeriodSummary,
} from "../api/statisticsApi";
import { fetchTransfers } from "../api/transfersApi";

const account = {
  id: 1,
  userId: 1,
  accountType: "BANK" as const,
  name: "Checking",
  currency: "PLN",
    cashBalance: 1000,
    openingBalance: 500, // differs from cashBalance so setup checklist completes
  openingCashAsOf: null,
  description: null,
  totalBalance: 1000,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function renderDashboard() {
  return render(
    <CurrencyProvider>
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
        </Routes>
      </MemoryRouter>
    </CurrencyProvider>,
  );
}

describe("DashboardPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.mocked(fetchAccounts).mockResolvedValue([account]);
    vi.mocked(fetchCategories).mockResolvedValue([
      {
        id: 1,
        name: "Salary",
        parentId: null,
        ledgerType: "INCOME",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    vi.mocked(fetchTransfers).mockResolvedValue({ items: [], nextCursor: null });
    vi.mocked(fetchNetWorth).mockResolvedValue({
      currency: "PLN",
      asOf: "2026-10-30",
      byBucket: {
        cash: 1000,
        stock: 0,
        crypto: 0,
        metal: 0,
        real_estate: 0,
        other: 0,
      },
      liabilities: 0,
      netWorth: 1000,
      ratesUsed: [],
    });
    vi.mocked(fetchNetWorthHistory).mockResolvedValue({
      currency: "PLN",
      monthCount: 24,
      ratesUsed: [],
      series: Array.from({ length: 24 }, (_, i) => ({
        month: `2024-${String((i % 12) + 1).padStart(2, "0")}`,
        asOf: `2024-${String((i % 12) + 1).padStart(2, "0")}-28`,
        netWorth: 1000 + i,
      })),
    });
    vi.mocked(fetchPeriodSummary).mockResolvedValue({
      month: "2026-10",
      period: "month",
      label: "2026-10",
      currency: "PLN",
      income: 3000,
      expense: 1000,
      net: 2000,
      transfers: 0,
    });
  });

  it("renders wealth hero and period KPIs for the reporting currency", async () => {
    renderDashboard();
    expect(await screen.findByText(/Income ·/)).toBeTruthy();
    expect(
      screen.getAllByText(/All accounts converted to PLN via NBP mid rates/)
        .length,
    ).toBeGreaterThan(0);
    expect(fetchNetWorth).toHaveBeenCalledWith("PLN");
    expect(fetchPeriodSummary).toHaveBeenCalled();
  });

  it("surfaces missing FX mid errors from net worth", async () => {
    vi.mocked(fetchNetWorth).mockRejectedValue(
      new Error("No EUR mid rate on or before 2026-10-30"),
    );
    renderDashboard();
    expect(
      await screen.findByText(/No EUR mid rate on or before/),
    ).toBeTruthy();
  });
});
