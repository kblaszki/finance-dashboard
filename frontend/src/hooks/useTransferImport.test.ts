import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTransferImport } from "./useTransferImport";

vi.mock("../api/transfersApi", () => ({
  previewTransfersImport: vi.fn(),
  importTransfersCsv: vi.fn(),
}));

import {
  importTransfersCsv,
  previewTransfersImport,
} from "../api/transfersApi";

function fileWithText(text: string): File {
  return {
    text: async () => text,
  } as File;
}

const accountsPreview = [
  {
    name: "Checking",
    currency: "PLN",
    rowCount: 1,
    suggestedAccountId: 1 as number | null,
  },
];

const mappings = [
  { name: "Checking", currency: "PLN", accountId: 1 },
  { name: "Brokerage", currency: "PLN", accountId: 2 },
];

const rows = [
  {
    row: 1,
    occurredAt: "2024-01-01T12:00:00.000Z",
    fromAccountId: 1,
    toAccountId: 2,
    amountFrom: 10,
    amountTo: 10,
    description: null as string | null,
    duplicate: false,
  },
];

describe("useTransferImport", () => {
  const onSuccess = vi.fn();
  const setActionError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets pending import after a non-empty bare preview", async () => {
    vi.mocked(previewTransfersImport).mockResolvedValue({
      rowCount: 1,
      accounts: accountsPreview,
      rows: [],
    });

    const { result } = renderHook(() =>
      useTransferImport({ onSuccess, setActionError }),
    );

    await act(async () => {
      await result.current.handleImportCsvFile(fileWithText("csv"));
    });

    expect(previewTransfersImport).toHaveBeenCalledWith("csv");
    expect(result.current.pendingImport).toEqual({
      csv: "csv",
      rowCount: 1,
      accounts: accountsPreview,
      rows: null,
      mappings: null,
    });
    expect(result.current.importMsg).toBeNull();
  });

  it("shows a message when the CSV has no transfers", async () => {
    vi.mocked(previewTransfersImport).mockResolvedValue({
      rowCount: 0,
      accounts: [],
      rows: [],
    });

    const { result } = renderHook(() =>
      useTransferImport({ onSuccess, setActionError }),
    );

    await act(async () => {
      await result.current.handleImportCsvFile(fileWithText("empty"));
    });

    expect(result.current.importMsg).toBe("No transfers in the CSV.");
    expect(result.current.pendingImport).toBeNull();
  });

  it("continues with mappings and stores resolved rows", async () => {
    vi.mocked(previewTransfersImport)
      .mockResolvedValueOnce({
        rowCount: 1,
        accounts: accountsPreview,
        rows: [],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        accounts: accountsPreview,
        rows,
      });

    const { result } = renderHook(() =>
      useTransferImport({ onSuccess, setActionError }),
    );

    await act(async () => {
      await result.current.handleImportCsvFile(fileWithText("csv"));
    });
    await act(async () => {
      await result.current.handleImportContinue(mappings);
    });

    expect(previewTransfersImport).toHaveBeenLastCalledWith("csv", mappings);
    expect(result.current.pendingImport?.rows).toEqual(rows);
    expect(result.current.pendingImport?.mappings).toEqual(mappings);
  });

  it("rejects continue when preview omits rows", async () => {
    vi.mocked(previewTransfersImport)
      .mockResolvedValueOnce({
        rowCount: 1,
        accounts: accountsPreview,
        rows: [],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        accounts: accountsPreview,
        rows: undefined as unknown as [],
      });

    const { result } = renderHook(() =>
      useTransferImport({ onSuccess, setActionError }),
    );

    await act(async () => {
      await result.current.handleImportCsvFile(fileWithText("csv"));
    });
    await act(async () => {
      await result.current.handleImportContinue(mappings);
    });

    expect(setActionError).toHaveBeenCalledWith(
      "Import preview did not return row details",
    );
  });

  it("confirms import with skipRows and clears pending", async () => {
    vi.mocked(previewTransfersImport)
      .mockResolvedValueOnce({
        rowCount: 1,
        accounts: accountsPreview,
        rows: [],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        accounts: accountsPreview,
        rows,
      });
    vi.mocked(importTransfersCsv).mockResolvedValue({
      created: 1,
      skipped: 0,
    });

    const { result } = renderHook(() =>
      useTransferImport({ onSuccess, setActionError }),
    );

    await act(async () => {
      await result.current.handleImportCsvFile(fileWithText("csv"));
    });
    await act(async () => {
      await result.current.handleImportContinue(mappings);
    });
    await act(async () => {
      await result.current.handleImportConfirm(mappings, []);
    });

    expect(importTransfersCsv).toHaveBeenCalledWith("csv", mappings, []);
    await waitFor(() => {
      expect(result.current.pendingImport).toBeNull();
    });
    expect(result.current.importMsg).toMatch(/Imported 1 transfer/);
    expect(onSuccess).toHaveBeenCalled();
  });

  it("surfaces preview errors", async () => {
    vi.mocked(previewTransfersImport).mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() =>
      useTransferImport({ onSuccess, setActionError }),
    );

    await act(async () => {
      await result.current.handleImportCsvFile(fileWithText("csv"));
    });

    expect(setActionError).toHaveBeenCalledWith("boom");
    expect(result.current.pendingImport).toBeNull();
  });
});
