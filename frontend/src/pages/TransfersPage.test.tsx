import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TransfersPage } from "./TransfersPage";
import { CurrencyProvider } from "../state/currency";

vi.mock("../api/accountsApi", () => ({
  fetchAccounts: vi.fn(),
}));

vi.mock("../api/transfersApi", async () => {
  const actual = await vi.importActual<typeof import("../api/transfersApi")>(
    "../api/transfersApi",
  );
  return {
    ...actual,
    fetchTransfers: vi.fn(),
    createTransfer: vi.fn(),
    updateTransfer: vi.fn(),
    deleteTransfer: vi.fn(),
    exportTransfersCsv: vi.fn(),
    previewTransfersImport: vi.fn(),
    importTransfersCsv: vi.fn(),
  };
});

import { fetchAccounts } from "../api/accountsApi";
import {
  exportTransfersCsv,
  fetchTransfers,
  importTransfersCsv,
  previewTransfersImport,
} from "../api/transfersApi";

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
  {
    id: 2,
    userId: 1,
    accountType: "BROKERAGE" as const,
    name: "Brokerage",
    currency: "PLN",
    cashBalance: 100,
    openingBalance: 100,
    openingCashAsOf: null,
    description: null,
    totalBalance: 100,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

function renderTransfers() {
  return render(
    <CurrencyProvider>
      <MemoryRouter initialEntries={["/transfers"]}>
        <Routes>
          <Route path="/transfers" element={<TransfersPage />} />
        </Routes>
      </MemoryRouter>
    </CurrencyProvider>,
  );
}

describe("TransfersPage CSV import/export", () => {
  beforeEach(() => {
    cleanup();
    vi.mocked(fetchAccounts).mockResolvedValue(accounts);
    vi.mocked(fetchTransfers).mockResolvedValue([]);
    vi.mocked(exportTransfersCsv).mockResolvedValue(new Blob(["csv"]));
    vi.mocked(previewTransfersImport).mockResolvedValue({
      rowCount: 1,
      accounts: [
        {
          name: "Alpha",
          currency: "PLN",
          rowCount: 1,
          suggestedAccountId: null,
        },
        {
          name: "Beta",
          currency: "PLN",
          rowCount: 1,
          suggestedAccountId: 2,
        },
      ],
    });
    vi.mocked(importTransfersCsv).mockResolvedValue({
      created: 1,
      skipped: 1,
    });
    URL.createObjectURL = vi.fn(() => "blob:transfers");
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  it("downloads transfers CSV", async () => {
    renderTransfers();
    await screen.findByText("Transfers");
    fireEvent.click(screen.getByRole("button", { name: "Download CSV" }));
    await waitFor(() => {
      expect(exportTransfersCsv).toHaveBeenCalled();
    });
  });

  it("maps accounts then imports with skipRows for duplicates", async () => {
    renderTransfers();
    await screen.findByText("Transfers");

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["csv-body"], "transfers.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", {
      value: () => Promise.resolve("csv-body"),
    });
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText("Map import accounts")).toBeTruthy();
    const continueBtn = screen.getByRole("button", {
      name: "Continue",
    }) as HTMLButtonElement;
    expect(continueBtn.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Mapping for Alpha PLN"), {
      target: { value: "1" },
    });
    expect(continueBtn.disabled).toBe(false);

    vi.mocked(previewTransfersImport).mockResolvedValueOnce({
      rowCount: 2,
      accounts: [
        {
          name: "Alpha",
          currency: "PLN",
          rowCount: 2,
          suggestedAccountId: 1,
        },
        {
          name: "Beta",
          currency: "PLN",
          rowCount: 2,
          suggestedAccountId: 2,
        },
      ],
      rows: [
        {
          row: 1,
          occurredAt: "2024-05-01T12:00:00.000Z",
          fromAccountId: 1,
          toAccountId: 2,
          amountFrom: 100,
          amountTo: 100,
          description: "move",
          duplicate: true,
        },
        {
          row: 2,
          occurredAt: "2024-05-02T12:00:00.000Z",
          fromAccountId: 1,
          toAccountId: 2,
          amountFrom: 50,
          amountTo: 50,
          description: "new",
          duplicate: false,
        },
      ],
    });

    fireEvent.click(continueBtn);
    expect(await screen.findByText("Review transfers")).toBeTruthy();
    expect(screen.getByText("Duplicate")).toBeTruthy();

    const dupCheckbox = screen.getByLabelText(
      "Include row 1",
    ) as HTMLInputElement;
    expect(dupCheckbox.checked).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Import 1 transfer" }));
    await waitFor(() => {
      expect(importTransfersCsv).toHaveBeenCalledWith(
        "csv-body",
        [
          { name: "Alpha", currency: "PLN", accountId: 1 },
          { name: "Beta", currency: "PLN", accountId: 2 },
        ],
        [1],
      );
    });
    expect(
      await screen.findByText("Imported 1 transfer(s); skipped 1."),
    ).toBeTruthy();
  });
});
