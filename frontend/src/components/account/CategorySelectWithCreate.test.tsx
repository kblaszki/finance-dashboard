import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CategorySelectWithCreate } from "./CategorySelectWithCreate";

const createCategory = vi.fn();

vi.mock("../../api/categoriesApi", async () => {
  const actual = await vi.importActual<typeof import("../../api/categoriesApi")>(
    "../../api/categoriesApi",
  );
  return {
    ...actual,
    createCategory: (...args: unknown[]) => createCategory(...args),
  };
});

beforeEach(() => {
  cleanup();
  createCategory.mockReset();
});

describe("CategorySelectWithCreate", () => {
  it("creates a category from + New category… and selects it", async () => {
    createCategory.mockResolvedValue({
      id: 42,
      name: "Coffee",
      parentId: null,
      ledgerType: "EXPENSE",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const onChange = vi.fn();
    const onCategoryCreated = vi.fn();
    const onError = vi.fn();

    render(
      <CategorySelectWithCreate
        value=""
        options={[]}
        ledgerType="EXPENSE"
        onChange={onChange}
        onCategoryCreated={onCategoryCreated}
        onError={onError}
        aria-label="New category"
      />,
    );

    fireEvent.change(screen.getByLabelText("New category"), {
      target: { value: "__new__" },
    });
    fireEvent.change(screen.getByLabelText("New category name"), {
      target: { value: "Coffee" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(createCategory).toHaveBeenCalledWith({
        name: "Coffee",
        ledgerType: "EXPENSE",
      });
      expect(onCategoryCreated).toHaveBeenCalled();
      expect(onChange).toHaveBeenCalledWith("42");
    });
  });

  it("does not forward blur when opening + New category…", () => {
    const onBlur = vi.fn();
    const onChange = vi.fn();
    const onCategoryCreated = vi.fn();
    const onError = vi.fn();

    render(
      <CategorySelectWithCreate
        value=""
        options={[]}
        ledgerType="EXPENSE"
        onChange={onChange}
        onCategoryCreated={onCategoryCreated}
        onError={onError}
        onBlur={onBlur}
        aria-label="Edit category"
      />,
    );

    const select = screen.getByLabelText("Edit category");
    fireEvent.change(select, { target: { value: "__new__" } });
    fireEvent.blur(select);

    expect(screen.getByLabelText("New category name")).toBeTruthy();
    expect(onBlur).not.toHaveBeenCalled();
  });
});
