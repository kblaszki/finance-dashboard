import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CashTransactionForm } from "./CashTransactionForm";

describe("CashTransactionForm", () => {
  beforeEach(() => {
    cleanup();
  });

  it("rejects a category that is not in the list", async () => {
    const onSubmit = vi.fn();
    render(<CashTransactionForm categories={[]} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "1" } });
    fireEvent.change(screen.getByPlaceholderText("Type to search categories"), {
      target: { value: "Nope" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add transaction (Enter)" }));
    expect(
      await screen.findByText("Choose an existing category from the list."),
    ).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits amount, type, and category id", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <CashTransactionForm
        categories={[
          { id: 1, name: "Income", parentId: null, createdAt: "2026-01-01T00:00:00.000Z" },
          { id: 2, name: "Salary", parentId: 1, createdAt: "2026-01-01T00:00:00.000Z" },
        ]}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "8" } });
    fireEvent.focus(screen.getByPlaceholderText("Type to search categories"));
    fireEvent.mouseDown(screen.getByRole("option", { name: /Salary/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add transaction (Enter)" }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ type: "INCOME", amount: 8, categoryId: 2 }),
      );
    });
  });
});
