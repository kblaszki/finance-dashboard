import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatCashImportSuccessMessage,
  isUnknownLedgerHeaderError,
  useCashLedgerImport,
} from "./useCashLedgerImport";

vi.mock("../api/transactionsApi", () => ({
  previewTransactionsImport: vi.fn(),
  importTransactionsCsv: vi.fn(),
  previewImportColumns: vi.fn(),
  fetchImportPresets: vi.fn(),
  applyImportColumnMapping: vi.fn(),
  commitImportColumnMapping: vi.fn(),
}));

import {
  applyImportColumnMapping,
  commitImportColumnMapping,
  fetchImportPresets,
  importTransactionsCsv,
  previewImportColumns,
  previewTransactionsImport,
} from "../api/transactionsApi";

function fileWithText(text: string): File {
  return {
    text: async () => text,
  } as File;
}

describe("isUnknownLedgerHeaderError", () => {
  it("detects UNKNOWN_LEDGER_CSV_HEADER code", () => {
    expect(
      isUnknownLedgerHeaderError(
        Object.assign(new Error("bad"), {
          code: "UNKNOWN_LEDGER_CSV_HEADER",
        }),
      ),
    ).toBe(true);
  });

  it("falls back to header message regex", () => {
    expect(
      isUnknownLedgerHeaderError(new Error("CSV header must be: type,...")),
    ).toBe(true);
    expect(isUnknownLedgerHeaderError(new Error("other"))).toBe(false);
  });
});

describe("formatCashImportSuccessMessage", () => {
  it("mentions duplicates and skipped transfers", () => {
    expect(
      formatCashImportSuccessMessage({
        created: 2,
        createdCategories: 1,
        skipped: 1,
        duplicateCount: 3,
      }),
    ).toMatch(/created 1 category/);
    expect(
      formatCashImportSuccessMessage({
        created: 2,
        createdCategories: 0,
        skipped: 0,
        duplicateCount: 0,
      }),
    ).toBe("Imported 2 transaction(s).");
  });
});

describe("useCashLedgerImport", () => {
  const onSuccess = vi.fn(async () => undefined);
  const setActionErr = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("imports immediately when preview needs no confirm", async () => {
    vi.mocked(previewTransactionsImport).mockResolvedValue({
      rowCount: 1,
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

    const { result } = renderHook(() =>
      useCashLedgerImport({ accountId: 7, onSuccess, setActionErr }),
    );

    await act(async () => {
      await result.current.handleImportCsvFile(fileWithText("csv"));
    });

    await waitFor(() => {
      expect(result.current.importMsg).toMatch(/Imported 1/);
    });
    expect(onSuccess).toHaveBeenCalled();
    expect(result.current.pendingImport).toBeNull();
  });

  it("sets pendingImport when description suggestions exist", async () => {
    vi.mocked(previewTransactionsImport).mockResolvedValue({
      rowCount: 1,
      categories: [],
      descriptionSuggestions: [
        {
          description: "Zabka",
          descriptionKey: "zabka",
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

    const { result } = renderHook(() =>
      useCashLedgerImport({ accountId: 7, onSuccess, setActionErr }),
    );

    await act(async () => {
      await result.current.handleImportCsvFile(fileWithText("csv"));
    });

    expect(result.current.pendingImport?.descriptionSuggestions).toHaveLength(
      1,
    );
    expect(importTransactionsCsv).not.toHaveBeenCalled();
  });

  it("starts column mapping when header code is UNKNOWN_LEDGER_CSV_HEADER", async () => {
    vi.mocked(previewTransactionsImport).mockRejectedValue(
      Object.assign(new Error("bad header"), {
        code: "UNKNOWN_LEDGER_CSV_HEADER",
      }),
    );
    vi.mocked(previewImportColumns).mockResolvedValue({
      delimiter: ";",
      headers: ["Data", "Kwota"],
      sampleRows: [],
      suggestedMapping: {
        occurredAt: 0,
        amount: 1,
        description: null,
        type: null,
        categoryPath: null,
        amountSignMode: "negativeIsExpense",
      },
      matchingPresetId: null,
    });
    vi.mocked(fetchImportPresets).mockResolvedValue([]);

    const { result } = renderHook(() =>
      useCashLedgerImport({ accountId: 7, onSuccess, setActionErr }),
    );

    await act(async () => {
      await result.current.handleImportCsvFile(fileWithText("weird"));
    });

    expect(result.current.pendingColumnMap?.columns.headers).toEqual([
      "Data",
      "Kwota",
    ]);
  });

  it("commits column mapping after confirm when no category/description work", async () => {
    vi.mocked(previewTransactionsImport).mockRejectedValue(
      Object.assign(new Error("bad"), { code: "UNKNOWN_LEDGER_CSV_HEADER" }),
    );
    vi.mocked(previewImportColumns).mockResolvedValue({
      delimiter: ",",
      headers: ["a", "b"],
      sampleRows: [],
      suggestedMapping: {
        occurredAt: 0,
        amount: 1,
        description: null,
        type: null,
        categoryPath: null,
        amountSignMode: "negativeIsExpense",
      },
      matchingPresetId: null,
    });
    vi.mocked(fetchImportPresets).mockResolvedValue([]);
    vi.mocked(applyImportColumnMapping).mockResolvedValue({
      rowCount: 1,
      categories: [],
      descriptionSuggestions: [],
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

    const { result } = renderHook(() =>
      useCashLedgerImport({ accountId: 7, onSuccess, setActionErr }),
    );

    await act(async () => {
      await result.current.handleImportCsvFile(fileWithText("csv"));
    });

    const mapping = {
      occurredAt: 0,
      amount: 1,
      description: null,
      type: null,
      categoryPath: null,
      amountSignMode: "negativeIsExpense" as const,
    };

    await act(async () => {
      await result.current.handleColumnMappingConfirm(mapping);
    });

    await waitFor(() => {
      expect(commitImportColumnMapping).toHaveBeenCalled();
      expect(result.current.importMsg).toMatch(/Imported 1/);
    });
  });
});
