import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  exportCategoriesCsv,
  fetchCategories,
  importCategoriesCsv,
  previewCategoriesImport,
} from "../api/categoriesApi";
import { fetchCategoryDescriptionRules } from "../api/categoryDescriptionRulesApi";

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
    cleanup();
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
