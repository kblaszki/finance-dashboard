import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StatisticsPage } from "./StatisticsPage";
import { CurrencyProvider } from "../state/currency";

vi.mock("../api/accountsApi", () => ({
  fetchAccounts: vi.fn(),
}));

vi.mock("../api/categoriesApi", () => ({
  fetchCategories: vi.fn(),
}));

vi.mock("../api/statisticsApi", () => ({
  fetchCategoryBreakdown: vi.fn(),
  fetchPeriodSummary: vi.fn(),
  fetchTagBreakdown: vi.fn(),
  fetchCashflowHistory: vi.fn(),
  fetchCashflowRolling12m: vi.fn(),
}));

import { fetchAccounts } from "../api/accountsApi";
import { fetchCategories } from "../api/categoriesApi";
import {
  fetchCashflowHistory,
  fetchCashflowRolling12m,
  fetchCategoryBreakdown,
  fetchPeriodSummary,
  fetchTagBreakdown,
} from "../api/statisticsApi";

const accounts = [
  {
    id: 1,
    userId: 1,
    accountType: "BANK" as const,
    name: "Checking",
    currency: "PLN",
    cashBalance: 1000,
    openingBalance: 1000,
    openingCashAsOf: null,
    description: null,
    totalBalance: 1000,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

function renderStats() {
  return render(
    <CurrencyProvider>
      <MemoryRouter initialEntries={["/statistics"]}>
        <Routes>
          <Route path="/statistics" element={<StatisticsPage />} />
        </Routes>
      </MemoryRouter>
    </CurrencyProvider>,
  );
}

describe("StatisticsPage period and analysis views", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.mocked(fetchAccounts).mockResolvedValue(accounts);
    vi.mocked(fetchCategories).mockResolvedValue([
      {
        id: 1,
        name: "Food",
        parentId: null,
        ledgerType: "EXPENSE",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    vi.mocked(fetchPeriodSummary).mockResolvedValue({
      month: "2026-08",
      period: "month",
      label: "2026-08",
      currency: "PLN",
      income: 3000,
      expense: 400,
      net: 2600,
      transfers: 150,
    });
    vi.mocked(fetchCategoryBreakdown).mockResolvedValue({
      month: "2026-08",
      period: "month",
      label: "2026-08",
      income: [],
      expense: [
        {
          categoryId: 1,
          categoryName: "Food",
          currency: "PLN",
          total: 400,
          count: 2,
        },
      ],
      transfer: [
        {
          categoryId: null,
          categoryName: "Uncategorized",
          currency: "PLN",
          total: 150,
          count: 1,
        },
      ],
    });
    vi.mocked(fetchTagBreakdown).mockResolvedValue({
      month: "2026-08",
      period: "month",
      label: "2026-08",
      currency: "PLN",
      income: [],
      expense: [
        { tagId: 9, tagName: "Lidl", total: 80, count: 1 },
      ],
      untagged: {
        income: 0,
        expense: 20,
        incomeCount: 0,
        expenseCount: 1,
      },
    });
    vi.mocked(fetchCashflowHistory).mockResolvedValue({
      currency: "PLN",
      monthCount: 6,
      series: [
        { month: "2026-03", income: 0, expense: 0, net: 0 },
        { month: "2026-04", income: 0, expense: 0, net: 0 },
        { month: "2026-05", income: 0, expense: 0, net: 0 },
        { month: "2026-06", income: 0, expense: 0, net: 0 },
        { month: "2026-07", income: 0, expense: 0, net: 0 },
        { month: "2026-08", income: 3000, expense: 400, net: 2600 },
      ],
    });
    vi.mocked(fetchCashflowRolling12m).mockResolvedValue({
      currency: "PLN",
      monthCount: 12,
      fromMonth: "2025-08",
      toMonth: "2026-07",
      avgIncome: 2800,
      avgExpense: 900,
      avgNet: 1900,
    });
  });

  it("shows KPIs including transfers and switches period to quarter", async () => {
    renderStats();
    expect(await screen.findByText(/Transfers ·/)).toBeTruthy();
    expect(screen.getAllByText(/PLN\s*150\.00/).length).toBeGreaterThan(0);
    expect(screen.getByText("Rolling 12-month averages")).toBeTruthy();
    expect(
      screen.getByText(/All accounts converted to PLN via NBP mid rates/),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Quarter" }));
    await waitFor(() => {
      expect(fetchPeriodSummary).toHaveBeenCalledWith(
        expect.any(String),
        "PLN",
        "quarter",
      );
    });
  });

  it("switches to Tags view and shows tag totals", async () => {
    renderStats();
    await screen.findByText(/Transfers ·/);
    fireEvent.click(screen.getByRole("tab", { name: "Tags" }));
    await waitFor(() => {
      expect(screen.getAllByText("Lidl").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("Untagged").length).toBeGreaterThan(0);
  });
});
