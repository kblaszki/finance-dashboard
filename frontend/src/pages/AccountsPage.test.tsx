import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Account } from "../api/accountsApi";
import { AccountsPage, filterAccountsByType } from "./AccountsPage";
import { CurrencyProvider } from "../state/currency";

vi.mock("../api/accountsApi", async () => {
  const actual = await vi.importActual<typeof import("../api/accountsApi")>(
    "../api/accountsApi",
  );
  return {
    ...actual,
    fetchAccounts: vi.fn(),
    createAccount: vi.fn(),
    updateAccount: vi.fn(),
    deleteAccount: vi.fn(),
  };
});

vi.mock("../api/transactionsApi", () => ({
  fetchTransactions: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
}));

import { createAccount, fetchAccounts } from "../api/accountsApi";

function account(
  partial: Partial<Account> & Pick<Account, "id" | "name" | "accountType">,
): Account {
  return {
    userId: 1,
    currency: "PLN",
    cashBalance: 0,
    openingBalance: 0,
    openingCashAsOf: null,
    description: null,
    totalBalance: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

function renderAccounts() {
  return render(
    <CurrencyProvider>
      <MemoryRouter initialEntries={["/accounts"]}>
        <Routes>
          <Route path="/accounts" element={<AccountsPage />} />
        </Routes>
      </MemoryRouter>
    </CurrencyProvider>,
  );
}

describe("filterAccountsByType", () => {
  const rows = [
    account({ id: 1, name: "Checking", accountType: "BANK" }),
    account({ id: 2, name: "Broker", accountType: "BROKERAGE" }),
    account({ id: 3, name: "Savings", accountType: "BANK" }),
  ];

  it("returns all accounts when filter is ALL", () => {
    expect(filterAccountsByType(rows, "ALL")).toEqual(rows);
  });

  it("filters by account type", () => {
    expect(filterAccountsByType(rows, "BANK").map((a) => a.id)).toEqual([1, 3]);
    expect(filterAccountsByType(rows, "BROKERAGE").map((a) => a.id)).toEqual([
      2,
    ]);
  });

  it("returns empty when no accounts match", () => {
    expect(filterAccountsByType(rows, "CRYPTO")).toEqual([]);
  });
});

describe("AccountsPage create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchAccounts).mockResolvedValue([
      account({ id: 1, name: "Checking", accountType: "BANK", cashBalance: 10 }),
    ]);
    vi.mocked(createAccount).mockResolvedValue(
      account({ id: 2, name: "Savings", accountType: "BANK" }),
    );
  });

  it("creates an account from the form", async () => {
    renderAccounts();
    expect(await screen.findByText("Checking")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Add account" }));
    fireEvent.change(screen.getByLabelText(/^Name$/i), {
      target: { value: "Savings" },
    });
    const currencySelect = screen.getByLabelText(/^Currency$/i);
    expect(currencySelect.tagName).toBe("SELECT");
    expect(
      Array.from((currencySelect as HTMLSelectElement).options).map(
        (o) => o.value,
      ),
    ).toEqual(["PLN", "EUR", "USD"]);
    fireEvent.change(currencySelect, { target: { value: "EUR" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(createAccount).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Savings", currency: "EUR" }),
      );
    });
  });
});
