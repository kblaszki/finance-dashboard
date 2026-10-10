import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountDetailPage } from "./AccountDetailPage";
import { CurrencyProvider } from "../state/currency";

vi.mock("../api/accountsApi", () => ({
  fetchAccount: vi.fn(),
  fetchAccounts: vi.fn(),
  fetchAccountBalanceHistory: vi.fn(),
}));

vi.mock("../api/categoriesApi", async () => {
  const actual = await vi.importActual<typeof import("../api/categoriesApi")>(
    "../api/categoriesApi",
  );
  return { ...actual, fetchCategories: vi.fn() };
});

vi.mock("../api/transactionsApi", async () => {
  const actual = await vi.importActual<typeof import("../api/transactionsApi")>(
    "../api/transactionsApi",
  );
  return {
    ...actual,
    fetchTransactions: vi.fn(),
    createTransaction: vi.fn(),
    deleteTransaction: vi.fn(),
    updateTransaction: vi.fn(),
    exportTransactionsCsv: vi.fn(),
    importTransactionsCsv: vi.fn(),
  };
});

import {
  fetchAccount,
  fetchAccountBalanceHistory,
  fetchAccounts,
} from "../api/accountsApi";
import { fetchCategories } from "../api/categoriesApi";
import {
  createTransaction,
  deleteTransaction,
  exportTransactionsCsv,
  fetchTransactions,
  importTransactionsCsv,
} from "../api/transactionsApi";

const account = {
  id: 1,
  userId: 1,
  accountType: "BANK",
  name: "Checking",
  currency: "USD",
  cashBalance: 10,
  openingBalance: 0,
  openingCashAsOf: null,
  description: null,
  totalBalance: 10,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const coffee = {
  id: 7,
  accountId: 1,
  type: "EXPENSE" as const,
  amount: 4.5,
  occurredAt: "2026-03-01T12:00:00.000Z",
  description: "Coffee",
  categoryId: null,
  createdAt: "2026-03-01T12:00:00.000Z",
};

function renderLedger(path = "/accounts/1") {
  return render(
    <CurrencyProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/accounts/:id" element={<AccountDetailPage />} />
        </Routes>
      </MemoryRouter>
    </CurrencyProvider>,
  );
}

describe("AccountDetailPage", () => {
  beforeEach(() => {
    cleanup();
    vi.mocked(fetchAccounts).mockResolvedValue([account]);
    vi.mocked(fetchAccount).mockResolvedValue(account);
    vi.mocked(fetchAccountBalanceHistory).mockResolvedValue({
      accountId: 1,
      currency: "USD",
      monthCount: 12,
      series: [
        { month: "2025-04", balance: 10 },
        { month: "2026-03", balance: 10 },
      ],
    });
    vi.mocked(fetchCategories).mockResolvedValue([
      {
        id: 1,
        name: "Salary",
        parentId: null,
        ledgerType: "INCOME",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: 2,
        name: "Food",
        parentId: null,
        ledgerType: "EXPENSE",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    vi.mocked(fetchTransactions).mockResolvedValue([coffee]);
    vi.mocked(createTransaction).mockResolvedValue(coffee);
    vi.mocked(deleteTransaction).mockResolvedValue(undefined);
    vi.mocked(exportTransactionsCsv).mockResolvedValue(new Blob(["id\n"]));
    vi.mocked(importTransactionsCsv).mockResolvedValue({ created: 1 });
    URL.createObjectURL = vi.fn(() => "blob:ledger");
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  it("lists transactions for the account", async () => {
    renderLedger();
    expect(await screen.findByText("Coffee")).toBeTruthy();
    expect(screen.getByText("Checking")).toBeTruthy();
    expect(fetchTransactions).toHaveBeenCalledWith(1);
  });

  it("creates a cash transaction from the ledger create row", async () => {
    renderLedger();
    await screen.findByText("Coffee");
    fireEvent.change(screen.getByLabelText("New amount"), {
      target: { value: "12.5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add transaction" }));
    await waitFor(() => {
      expect(createTransaction).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          type: "EXPENSE",
          amount: 12.5,
          description: null,
          categoryId: null,
        }),
      );
    });
  });

  it("deletes a transaction after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderLedger();
    await screen.findByText("Coffee");
    fireEvent.click(screen.getByRole("button", { name: "Delete EXPENSE 4.5" }));
    await waitFor(() => {
      expect(deleteTransaction).toHaveBeenCalledWith(1, 7);
    });
  });

  it("triggers CSV export and import", async () => {
    renderLedger();
    await screen.findByText("Coffee");
    fireEvent.click(screen.getByRole("button", { name: "Download CSV" }));
    await waitFor(() => {
      expect(exportTransactionsCsv).toHaveBeenCalledWith(1);
    });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["id\n"], "ledger.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", { value: () => Promise.resolve("id\n") });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(importTransactionsCsv).toHaveBeenCalledWith(1, "id\n");
    });
    expect(await screen.findByText("Imported 1 transaction(s).")).toBeTruthy();
  });

  it("rejects an invalid account id", () => {
    renderLedger("/accounts/nope");
    expect(screen.getByText("Invalid account id.")).toBeTruthy();
  });
});
