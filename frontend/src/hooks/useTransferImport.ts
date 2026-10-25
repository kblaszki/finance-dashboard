import { useState } from "react";
import {
  importTransfersCsv,
  previewTransfersImport,
  type TransferAccountMapping,
  type TransferAccountPreview,
  type TransferImportRowPreview,
} from "../api/transfersApi";

export type PendingTransferImport = {
  csv: string;
  rowCount: number;
  accounts: TransferAccountPreview[];
  rows: TransferImportRowPreview[] | null;
  mappings: TransferAccountMapping[] | null;
};

type Options = {
  onSuccess: () => void;
  setActionError: (message: string | null) => void;
};

export function useTransferImport(options: Options) {
  const { onSuccess, setActionError } = options;
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [pendingImport, setPendingImport] =
    useState<PendingTransferImport | null>(null);

  async function handleImportCsvFile(file: File) {
    setActionError(null);
    setImportMsg(null);
    setPendingImport(null);
    setImportBusy(true);
    try {
      const csv = await file.text();
      const preview = await previewTransfersImport(csv);
      if (preview.rowCount === 0) {
        setImportMsg("No transfers in the CSV.");
        return;
      }
      setPendingImport({
        csv,
        rowCount: preview.rowCount,
        accounts: preview.accounts,
        rows: null,
        mappings: null,
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImportBusy(false);
    }
  }

  async function handleImportContinue(mappings: TransferAccountMapping[]) {
    if (!pendingImport) return;
    setImportBusy(true);
    setActionError(null);
    try {
      const preview = await previewTransfersImport(
        pendingImport.csv,
        mappings,
      );
      if (!Array.isArray(preview.rows)) {
        throw new Error("Import preview did not return row details");
      }
      setPendingImport({
        ...pendingImport,
        accounts: preview.accounts,
        rows: preview.rows,
        mappings,
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImportBusy(false);
    }
  }

  async function handleImportConfirm(
    mappings: TransferAccountMapping[],
    skipRows: number[],
  ) {
    if (!pendingImport) return;
    setImportBusy(true);
    setActionError(null);
    setImportMsg(null);
    try {
      const result = await importTransfersCsv(
        pendingImport.csv,
        mappings,
        skipRows,
      );
      setImportMsg(
        `Imported ${result.created} transfer(s); skipped ${result.skipped}.`,
      );
      setPendingImport(null);
      onSuccess();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImportBusy(false);
    }
  }

  return {
    importMsg,
    setImportMsg,
    importBusy,
    pendingImport,
    setPendingImport,
    handleImportCsvFile,
    handleImportContinue,
    handleImportConfirm,
  };
}
