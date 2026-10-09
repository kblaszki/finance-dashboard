import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CashTransaction } from "../../api/transactionsApi";
import { LedgerTable } from "./LedgerTable";

const coffee: CashTransaction = {
  id: 7,
  accountId: 1,
  type: "EXPENSE",
  amount: 4.5,
  occurredAt: "2026-03-01T12:00:00.000Z",
  description: "Coffee",
  categoryId: null,
  createdAt: "2026-03-01T12:00:00.000Z",
};

const categories = [
  { id: 1, name: "Income", parentId: null, createdAt: "2026-01-01T00:00:00.000Z" },
  { id: 2, name: "Expense", parentId: null, createdAt: "2026-01-01T00:00:00.000Z" },
  { id: 3, name: "Food", parentId: 2, createdAt: "2026-01-01T00:00:00.000Z" },
];

function renderTable(
  overrides: Partial<{
    onSave: ReturnType<typeof vi.fn>;
    onDelete: ReturnType<typeof vi.fn>;
    onActionError: ReturnType<typeof vi.fn>;
    tx: CashTransaction;
  }> = {},
) {
  const onSave = overrides.onSave ?? vi.fn().mockResolvedValue(undefined);
  const onDelete = overrides.onDelete ?? vi.fn();
  const onActionError = overrides.onActionError ?? vi.fn();
  const tx = overrides.tx ?? coffee;
  render(
    <LedgerTable
      transactions={[tx]}
      currency="USD"
      categories={categories}
      categoryNameById={new Map([[3, "Food"]])}
      onDelete={onDelete}
      onSave={onSave}
      onActionError={onActionError}
    />,
  );
  return { onSave, onDelete, onActionError };
}

describe("LedgerTable", () => {
  beforeEach(() => {
    cleanup();
  });

  it("saves amount on double-click then Enter", async () => {
    const { onSave } = renderTable();
    fireEvent.doubleClick(screen.getByText("$4.50"));
    const input = screen.getByLabelText("Edit amount");
    fireEvent.change(input, { target: { value: "9.25" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(coffee, { amount: 9.25 });
    });
  });

  it("cancels on Escape without calling onSave", () => {
    const { onSave } = renderTable();
    fireEvent.doubleClick(screen.getByText("Coffee"));
    const input = screen.getByLabelText("Edit description");
    fireEvent.change(input, { target: { value: "Tea" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("Coffee")).toBeTruthy();
  });

  it("saves empty description as null", async () => {
    const { onSave } = renderTable();
    fireEvent.doubleClick(screen.getByText("Coffee"));
    const input = screen.getByLabelText("Edit description");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(coffee, { description: null });
    });
  });
});
