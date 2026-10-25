import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Account } from "../../api/accountsApi";
import type { Category } from "../../api/categoriesApi";
import type { CashTransfer } from "../../api/transfersApi";
import { formatMoney } from "../../utils/format";
import { TransferTable } from "./TransferTable";

vi.mock("../../api/transfersApi", async () => {
  const actual = await vi.importActual<typeof import("../../api/transfersApi")>(
    "../../api/transfersApi",
  );
  return {
    ...actual,
    updateTransfer: vi.fn().mockResolvedValue(undefined),
    deleteTransfer: vi.fn().mockResolvedValue(undefined),
  };
});

import { updateTransfer } from "../../api/transfersApi";

const accounts: Account[] = [
  {
    id: 1,
    name: "Checking",
    currency: "USD",
    accountType: "BANK",
    cashBalance: 1000,
    openingBalance: 1000,
    totalBalance: 1000,
    description: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 2,
    name: "Savings",
    currency: "USD",
    accountType: "BANK",
    cashBalance: 500,
    openingBalance: 500,
    totalBalance: 500,
    description: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 3,
    name: "Euro",
    currency: "EUR",
    accountType: "BANK",
    cashBalance: 200,
    openingBalance: 200,
    totalBalance: 200,
    description: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

const transferCategories: Category[] = [
  {
    id: 9,
    name: "Move",
    parentId: null,
    ledgerType: "TRANSFER",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

const sameCurrency: CashTransfer = {
  id: 10,
  fromAccountId: 1,
  toAccountId: 2,
  fromCurrency: "USD",
  toCurrency: "USD",
  amountFrom: 100,
  amountTo: 100,
  fxRate: null,
  occurredAt: "2026-03-01T12:00:00.000Z",
  description: "Save",
  categoryId: null,
  createdAt: "2026-03-01T12:00:00.000Z",
};

const crossCurrency: CashTransfer = {
  id: 11,
  fromAccountId: 1,
  toAccountId: 3,
  fromCurrency: "USD",
  toCurrency: "EUR",
  amountFrom: 400,
  amountTo: 90,
  fxRate: 0.225,
  occurredAt: "2026-03-02T12:00:00.000Z",
  description: "Travel",
  categoryId: null,
  createdAt: "2026-03-02T12:00:00.000Z",
};

function renderTable(transfers: CashTransfer[] = [sameCurrency]) {
  const onMutated = vi.fn();
  const onActionError = vi.fn();
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  render(
    <TransferTable
      transfers={transfers}
      accounts={accounts}
      accountById={accountById}
      transferCategories={transferCategories}
      sort={null}
      onSortChange={vi.fn()}
      seedFromAccountId={null}
      onSeedConsumed={vi.fn()}
      onCreate={vi.fn().mockResolvedValue(undefined)}
      onCategoryCreated={vi.fn()}
      onActionError={onActionError}
      onMutated={onMutated}
    />,
  );
  return { onMutated, onActionError };
}

describe("TransferTable", () => {
  beforeEach(() => {
    cleanup();
    vi.mocked(updateTransfer).mockClear();
  });

  it("saves amountFrom on double-click then Enter", async () => {
    const { onMutated } = renderTable();
    const amounts = screen.getAllByText(formatMoney(100, "USD"));
    fireEvent.doubleClick(amounts[0]!);
    const input = screen.getByLabelText("Edit amount from");
    fireEvent.change(input, { target: { value: "150" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => {
      expect(updateTransfer).toHaveBeenCalledWith(10, { amountFrom: 150 });
    });
    expect(onMutated).toHaveBeenCalled();
  });

  it("cancels description edit on Escape without calling updateTransfer", () => {
    renderTable();
    fireEvent.doubleClick(screen.getByText("Save"));
    const input = screen.getByLabelText("Edit description");
    fireEvent.change(input, { target: { value: "Nope" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(updateTransfer).not.toHaveBeenCalled();
    expect(screen.getByText("Save")).toBeTruthy();
  });

  it("does not open amountTo editor for same-currency transfers", () => {
    renderTable([sameCurrency]);
    const amounts = screen.getAllByText(formatMoney(100, "USD"));
    expect(amounts.length).toBeGreaterThanOrEqual(2);
    fireEvent.doubleClick(amounts[1]!);
    expect(screen.queryByLabelText("Edit amount to")).toBeNull();
    expect(updateTransfer).not.toHaveBeenCalled();
  });

  it("saves amountTo on cross-currency transfer", async () => {
    const { onMutated } = renderTable([crossCurrency]);
    fireEvent.doubleClick(screen.getByText(formatMoney(90, "EUR")));
    const input = screen.getByLabelText("Edit amount to");
    fireEvent.change(input, { target: { value: "95" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => {
      expect(updateTransfer).toHaveBeenCalledWith(11, { amountTo: 95 });
    });
    expect(onMutated).toHaveBeenCalled();
  });
});
