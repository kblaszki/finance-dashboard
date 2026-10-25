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

vi.mock("../api/tagsApi", () => ({
  fetchTags: vi.fn(),
}));

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
    previewTransactionsImport: vi.fn(),
    importTransactionsCsv: vi.fn(),
    previewImportColumns: vi.fn(),
    applyImportColumnMapping: vi.fn(),
    commitImportColumnMapping: vi.fn(),
    fetchImportPresets: vi.fn(),
  };
});

import {
  fetchAccount,
  fetchAccountBalanceHistory,
  fetchAccounts,
} from "../api/accountsApi";
import { fetchCategories } from "../api/categoriesApi";
import { fetchTags } from "../api/tagsApi";
import {
  applyImportColumnMapping,
  commitImportColumnMapping,
  createTransaction,
  deleteTransaction,
  exportTransactionsCsv,
  fetchImportPresets,
  fetchTransactions,
  importTransactionsCsv,
  previewImportColumns,
  previewTransactionsImport,
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
  tagIds: [] as number[],
  transferId: null,
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
    vi.mocked(fetchTags).mockResolvedValue([
      { id: 10, name: "Work", createdAt: "2026-01-01T00:00:00.000Z" },
    ]);
    vi.mocked(fetchTransactions).mockResolvedValue({
      items: [coffee],
      nextCursor: null,
    });
    vi.mocked(createTransaction).mockResolvedValue(coffee);
    vi.mocked(deleteTransaction).mockResolvedValue(undefined);
    vi.mocked(exportTransactionsCsv).mockResolvedValue(new Blob(["id\n"]));
    vi.mocked(previewTransactionsImport).mockResolvedValue({
      rowCount: 0,
      categories: [],
      descriptionSuggestions: [],
      skipped: 0,
      skippedTransfers: [],
      duplicateCount: 0,
      skippedDuplicates: [],
    });
    vi.mocked(importTransactionsCsv).mockResolvedValue({
      created: 1,
      createdCategories: 0,
      skipped: 0,
      skippedTransfers: [],
      duplicateCount: 0,
      skippedDuplicates: [],
    });
    vi.mocked(fetchImportPresets).mockResolvedValue([]);
    vi.mocked(previewImportColumns).mockResolvedValue({
      delimiter: ",",
      headers: ["Date", "Amount", "Memo"],
      sampleRows: [["2026-01-01", "-5.00", "Shop"]],
      suggestedMapping: {
        occurredAt: 0,
        amount: 1,
        description: 2,
        type: null,
        categoryPath: null,
        amountSignMode: "negativeIsExpense",
      },
      matchingPresetId: null,
    });
    vi.mocked(applyImportColumnMapping).mockResolvedValue({
      rowCount: 1,
      categories: [],
      descriptionSuggestions: [
        {
          description: "Shop",
          descriptionKey: "shop",
          ledgerType: "EXPENSE",
          rowCount: 1,
          suggestedCategoryId: 2,
          suggestionSource: "history",
        },
      ],
      skipped: 0,
      skippedTransfers: [],
      duplicateCount: 0,
      skippedDuplicates: [],
    });
    vi.mocked(commitImportColumnMapping).mockResolvedValue({
      created: 1,
      createdCategories: 0,
      skipped: 0,
      skippedTransfers: [],
      duplicateCount: 0,
      skippedDuplicates: [],
    });
    URL.createObjectURL = vi.fn(() => "blob:ledger");
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  it("lists transactions for the account", async () => {
    renderLedger();
    expect(await screen.findByText("Coffee")).toBeTruthy();
    expect(screen.getByText("Checking")).toBeTruthy();
    expect(fetchTransactions).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ month: expect.any(String) }),
    );
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
          tagIds: [],
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

  it("triggers CSV export and imports when preview has no categories", async () => {
    renderLedger();
    await screen.findByText("Coffee");
    fireEvent.click(screen.getByRole("button", { name: "Download CSV" }));
    await waitFor(() => {
      expect(exportTransactionsCsv).toHaveBeenCalledWith(1);
    });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["csv"], "ledger.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", {
      value: () => Promise.resolve("header-only\n"),
    });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(previewTransactionsImport).toHaveBeenCalledWith(1, "header-only\n");
      expect(importTransactionsCsv).toHaveBeenCalledWith(
        1,
        "header-only\n",
        [],
        [],
      );
    });
    expect(await screen.findByText("Imported 1 transaction(s).")).toBeTruthy();
  });

  it("mentions skipped transfer rows after a direct import", async () => {
    vi.mocked(importTransactionsCsv).mockResolvedValue({
      created: 1,
      createdCategories: 0,
      skipped: 2,
      skippedTransfers: [
        {
          row: 2,
          type: "TRANSFER_OUT",
          message: "Internal transfer — import via Transfers page",
        },
        {
          row: 3,
          type: "TRANSFER_IN",
          message: "Internal transfer — import via Transfers page",
        },
      ],
      duplicateCount: 0,
      skippedDuplicates: [],
    });

    renderLedger();
    await screen.findByText("Coffee");

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["csv"], "ledger.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", {
      value: () => Promise.resolve("with-transfers\n"),
    });
    fireEvent.change(input, { target: { files: [file] } });

    expect(
      await screen.findByText(
        "Imported 1 transaction(s). Skipped 2 internal transfer row(s) — manage transfers on the Transfers page.",
      ),
    ).toBeTruthy();
  });

  it("shows mapping panel and imports after category decisions", async () => {
    vi.mocked(previewTransactionsImport).mockResolvedValue({
      rowCount: 2,
      categories: [
        {
          path: "Food",
          ledgerType: "EXPENSE",
          rowCount: 1,
          suggestedCategoryId: 2,
        },
        {
          path: "NewPath",
          ledgerType: "EXPENSE",
          rowCount: 1,
          suggestedCategoryId: null,
        },
      ],
      descriptionSuggestions: [],
      skipped: 1,
      skippedTransfers: [
        {
          row: 3,
          type: "TRANSFER_OUT",
          message: "Internal transfer — import via Transfers page",
        },
      ],
      duplicateCount: 0,
      skippedDuplicates: [],
    });

    renderLedger();
    await screen.findByText("Coffee");

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["csv-body"], "ledger.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", {
      value: () => Promise.resolve("csv-body"),
    });
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText("Confirm import categories")).toBeTruthy();
    expect(
      screen.getByText(
        "Skipping 1 internal transfer row(s) — manage transfers on the Transfers page.",
      ),
    ).toBeTruthy();
    const importBtn = screen.getByRole("button", {
      name: "Import",
    }) as HTMLButtonElement;
    expect(importBtn.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Mapping for NewPath"), {
      target: { value: "create" },
    });
    expect(importBtn.disabled).toBe(false);

    fireEvent.click(importBtn);
    await waitFor(() => {
      expect(importTransactionsCsv).toHaveBeenCalledWith(
        1,
        "csv-body",
        [
          {
            path: "Food",
            ledgerType: "EXPENSE",
            action: "map",
            categoryId: 2,
          },
          {
            path: "NewPath",
            ledgerType: "EXPENSE",
            action: "create",
          },
        ],
        [],
      );
    });
  });

  it("maps unknown CSV header via columns then description suggestions", async () => {
    vi.mocked(previewTransactionsImport).mockRejectedValue(
      Object.assign(new Error("CSV header must be: id,type,amount,..."), {
        code: "UNKNOWN_LEDGER_CSV_HEADER",
      }),
    );

    renderLedger();
    await screen.findByText("Coffee");

    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["Date,Amount,Memo\n"], "bank.csv", {
      type: "text/csv",
    });
    Object.defineProperty(file, "text", {
      value: () => Promise.resolve("Date,Amount,Memo\n2026-01-01,-5.00,Shop\n"),
    });
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText(/Map CSV columns/i)).toBeTruthy();
    await waitFor(() => {
      expect(previewImportColumns).toHaveBeenCalled();
      expect(fetchImportPresets).toHaveBeenCalledWith(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Confirm import categories")).toBeTruthy();
    expect(screen.getByText("Shop")).toBeTruthy();
    expect(screen.getByText("History")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    await waitFor(() => {
      expect(commitImportColumnMapping).toHaveBeenCalledWith(
        1,
        expect.any(String),
        expect.objectContaining({
          occurredAt: 0,
          amount: 1,
          description: 2,
        }),
        [],
        [
          {
            descriptionKey: "shop",
            ledgerType: "EXPENSE",
            action: "map",
            categoryId: 2,
          },
        ],
      );
    });
  });

  it("rejects an invalid account id", () => {
    renderLedger("/accounts/nope");
    expect(screen.getByText("Invalid account id.")).toBeTruthy();
  });
});
