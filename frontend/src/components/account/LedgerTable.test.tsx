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
  {
    id: 1,
    name: "Salary",
    parentId: null,
    ledgerType: "INCOME" as const,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 3,
    name: "Food",
    parentId: null,
    ledgerType: "EXPENSE" as const,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

function renderTable(
  overrides: Partial<{
    onSave: ReturnType<typeof vi.fn>;
    onCreate: ReturnType<typeof vi.fn>;
    onDelete: ReturnType<typeof vi.fn>;
    onActionError: ReturnType<typeof vi.fn>;
    transactions: CashTransaction[];
  }> = {},
) {
  const onSave = overrides.onSave ?? vi.fn().mockResolvedValue(undefined);
  const onCreate = overrides.onCreate ?? vi.fn().mockResolvedValue(undefined);
  const onDelete = overrides.onDelete ?? vi.fn();
  const onActionError = overrides.onActionError ?? vi.fn();
  const transactions = overrides.transactions ?? [coffee];
  const { rerender } = render(
    <LedgerTable
      accountId={1}
      transactions={transactions}
      currency="USD"
      categories={categories}
      categoryNameById={new Map([[3, "Food"]])}
      onCreate={onCreate}
      onDelete={onDelete}
      onSave={onSave}
      onActionError={onActionError}
    />,
  );
  return { onSave, onCreate, onDelete, onActionError, rerender };
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

  it("cancels on blur without calling onSave", async () => {
    const { onSave } = renderTable();
    fireEvent.doubleClick(screen.getByText("Coffee"));
    const input = screen.getByLabelText("Edit description");
    fireEvent.change(input, { target: { value: "Tea" } });
    fireEvent.blur(input);
    await waitFor(() => {
      expect(screen.getByText("Coffee")).toBeTruthy();
    });
    expect(onSave).not.toHaveBeenCalled();
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

  it("seeds create type from newest ledger row", () => {
    renderTable();
    expect((screen.getByLabelText("New type") as HTMLSelectElement).value).toBe(
      "EXPENSE",
    );
  });

  it("keeps session type after create even when seed becomes INCOME", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderTable({ onCreate });

    fireEvent.change(screen.getByLabelText("New amount"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add transaction" }));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({ type: "EXPENSE", amount: 3 }),
      );
    });

    const incomeNewest: CashTransaction = {
      ...coffee,
      id: 99,
      type: "INCOME",
      amount: 100,
      description: "Pay",
    };

    rerender(
      <LedgerTable
        accountId={1}
        transactions={[incomeNewest, coffee]}
        currency="USD"
        categories={categories}
        categoryNameById={new Map([[3, "Food"]])}
        onCreate={onCreate}
        onDelete={vi.fn()}
        onSave={vi.fn()}
        onActionError={vi.fn()}
      />,
    );

    expect((screen.getByLabelText("New type") as HTMLSelectElement).value).toBe(
      "EXPENSE",
    );
  });
});
