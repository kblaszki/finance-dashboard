import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CategoriesPage } from "./CategoriesPage";

vi.mock("../api/categoriesApi", async () => {
  const actual = await vi.importActual<typeof import("../api/categoriesApi")>(
    "../api/categoriesApi",
  );
  return {
    ...actual,
    fetchCategories: vi.fn(),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn(),
    exportCategoriesCsv: vi.fn(),
    previewCategoriesImport: vi.fn(),
    importCategoriesCsv: vi.fn(),
  };
});

vi.mock("../api/categoryDescriptionRulesApi", () => ({
  fetchCategoryDescriptionRules: vi.fn(),
  createCategoryDescriptionRule: vi.fn(),
  deleteCategoryDescriptionRule: vi.fn(),
  updateCategoryDescriptionRule: vi.fn(),
}));

import {
  createCategory,
  deleteCategory,
  exportCategoriesCsv,
  fetchCategories,
  importCategoriesCsv,
  previewCategoriesImport,
  updateCategory,
} from "../api/categoriesApi";
import {
  createCategoryDescriptionRule,
  deleteCategoryDescriptionRule,
  fetchCategoryDescriptionRules,
} from "../api/categoryDescriptionRulesApi";

const categories = [
  {
    id: 1,
    name: "Food",
    parentId: null,
    ledgerType: "EXPENSE" as const,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 2,
    name: "Salary",
    parentId: null,
    ledgerType: "INCOME" as const,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

function renderCategories() {
  return render(
    <MemoryRouter initialEntries={["/categories"]}>
      <Routes>
        <Route path="/categories" element={<CategoriesPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("CategoriesPage CSV import/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchCategories).mockResolvedValue(categories);
    vi.mocked(fetchCategoryDescriptionRules).mockResolvedValue([]);
    vi.mocked(exportCategoriesCsv).mockResolvedValue(new Blob(["csv"]));
    vi.mocked(previewCategoriesImport).mockResolvedValue({
      rowCount: 2,
      existing: 1,
      toCreate: 1,
      rows: [
        { path: "Food", ledgerType: "EXPENSE", status: "exists" },
        { path: "Food/Groceries", ledgerType: "EXPENSE", status: "create" },
      ],
    });
    vi.mocked(importCategoriesCsv).mockResolvedValue({
      created: 1,
      skipped: 1,
    });
  });

  it("downloads categories CSV", async () => {
    renderCategories();
    await screen.findByText("Categories");
    fireEvent.click(screen.getByRole("button", { name: "Download CSV" }));
    await waitFor(() => {
      expect(exportCategoriesCsv).toHaveBeenCalled();
    });
  });

  it("previews then imports categories CSV", async () => {
    renderCategories();
    await screen.findByText("Categories");

    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["csv-body"], "categories.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", {
      value: () => Promise.resolve("csv-body"),
    });
    fireEvent.change(input, { target: { files: [file] } });

    expect(
      await screen.findByText("Will create 1; 1 already exist."),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    await waitFor(() => {
      expect(importCategoriesCsv).toHaveBeenCalledWith("csv-body");
    });
    expect(
      await screen.findByText("Created 1; skipped 1."),
    ).toBeTruthy();
  });

  it("shows message when all rows already exist", async () => {
    vi.mocked(previewCategoriesImport).mockResolvedValue({
      rowCount: 1,
      existing: 1,
      toCreate: 0,
      rows: [{ path: "Food", ledgerType: "EXPENSE", status: "exists" }],
    });
    renderCategories();
    await screen.findByText("Categories");

    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["csv-body"], "categories.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", {
      value: () => Promise.resolve("csv-body"),
    });
    fireEvent.change(input, { target: { files: [file] } });

    expect(
      await screen.findByText("All 1 category already exists."),
    ).toBeTruthy();
    expect(importCategoriesCsv).not.toHaveBeenCalled();
  });
});

describe("CategoriesPage CRUD", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchCategories).mockResolvedValue(categories);
    vi.mocked(fetchCategoryDescriptionRules).mockResolvedValue([]);
    vi.mocked(createCategory).mockResolvedValue({
      id: 3,
      name: "Groceries",
      parentId: 1,
      ledgerType: "EXPENSE",
      createdAt: "2026-01-02T00:00:00.000Z",
    });
    vi.mocked(updateCategory).mockResolvedValue({
      id: 1,
      name: "Foods",
      parentId: null,
      ledgerType: "EXPENSE",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    vi.mocked(deleteCategory).mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("creates, renames, and deletes a category", async () => {
    renderCategories();
    const deleteFood = await screen.findByRole("button", {
      name: "Delete Food",
    });

    const nameInputs = screen.getAllByLabelText("New category name");
    // Expense section create row is second (Income, Expense, Transfer).
    fireEvent.change(nameInputs[1]!, { target: { value: "Groceries" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Add category" })[1]!);

    await waitFor(() => {
      expect(createCategory).toHaveBeenCalledWith({
        name: "Groceries",
        parentId: null,
        ledgerType: "EXPENSE",
      });
    });

    const foodCell = deleteFood.closest("tr")?.querySelector(".category-root");
    expect(foodCell).toBeTruthy();
    fireEvent.doubleClick(foodCell!);
    const editName = screen.getByLabelText("Edit name");
    fireEvent.change(editName, { target: { value: "Foods" } });
    fireEvent.keyDown(editName, { key: "Enter" });
    await waitFor(() => {
      expect(updateCategory).toHaveBeenCalledWith(1, { name: "Foods" });
    });

    fireEvent.click(deleteFood);
    await waitFor(() => {
      expect(deleteCategory).toHaveBeenCalledWith(1);
    });
  });
});

describe("CategoriesPage description rules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchCategories).mockResolvedValue(categories);
    vi.mocked(fetchCategoryDescriptionRules).mockResolvedValue([
      {
        id: 9,
        pattern: "uber",
        ledgerType: "EXPENSE",
        categoryId: 1,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    vi.mocked(createCategoryDescriptionRule).mockResolvedValue({
      id: 10,
      pattern: "zabka",
      ledgerType: "EXPENSE",
      categoryId: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    vi.mocked(deleteCategoryDescriptionRule).mockResolvedValue(undefined);
  });

  it("creates and deletes a description rule", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderCategories();
    expect(await screen.findByText("Description rules")).toBeTruthy();
    expect(screen.getByText("uber")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Rule pattern"), {
      target: { value: "zabka" },
    });
    fireEvent.change(screen.getByLabelText("Rule category"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add rule" }));

    await waitFor(() => {
      expect(createCategoryDescriptionRule).toHaveBeenCalledWith({
        pattern: "zabka",
        ledgerType: "EXPENSE",
        categoryId: 1,
      });
    });
    await waitFor(() => {
      expect(
        (screen.getByLabelText("Rule pattern") as HTMLInputElement).value,
      ).toBe("");
      expect(
        (screen.getByRole("button", { name: "Add rule" }) as HTMLButtonElement)
          .disabled,
      ).toBe(false);
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete rule uber" }));
    await waitFor(() => {
      expect(deleteCategoryDescriptionRule).toHaveBeenCalledWith(9);
    });
  });
});
