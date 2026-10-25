import { useState } from "react";
import {
  applyImportColumnMapping,
  commitImportColumnMapping,
  fetchImportPresets,
  importTransactionsCsv,
  previewImportColumns,
  previewTransactionsImport,
  type ColumnMapping,
  type CsvImportPreset,
  type ImportCategoryMapping,
  type ImportCategoryPreview,
  type ImportColumnsPreview,
  type ImportDescriptionMapping,
  type ImportDescriptionSuggestion,
  type SkippedDuplicateRow,
} from "../api/transactionsApi";

export type PendingCashImport = {
  csv: string;
  rowCount: number;
  categories: ImportCategoryPreview[];
  descriptionSuggestions: ImportDescriptionSuggestion[];
  skipped: number;
  duplicateCount: number;
  skippedDuplicates: SkippedDuplicateRow[];
  columnMapping?: ColumnMapping;
};

export type PendingColumnMap = {
  csv: string;
  columns: ImportColumnsPreview;
  presets: CsvImportPreset[];
};

function needsImportConfirm(preview: {
  categories: ImportCategoryPreview[];
  descriptionSuggestions: ImportDescriptionSuggestion[];
}): boolean {
  return (
    preview.categories.length > 0 || preview.descriptionSuggestions.length > 0
  );
}

export function isUnknownLedgerHeaderError(err: unknown): boolean {
  return (
    !!err &&
    typeof err === "object" &&
    "code" in err &&
    (err as { code?: string }).code === "UNKNOWN_LEDGER_CSV_HEADER"
  );
}

export function formatCashImportSuccessMessage(result: {
  created: number;
  createdCategories: number;
  skipped: number;
  duplicateCount?: number;
}): string {
  const createdNote =
    result.createdCategories > 0
      ? `Imported ${result.created} transaction(s); created ${result.createdCategories} categor${result.createdCategories === 1 ? "y" : "ies"}.`
      : `Imported ${result.created} transaction(s).`;
  const parts = [createdNote];
  const duplicates = result.duplicateCount ?? 0;
  if (duplicates > 0) {
    parts.push(`Skipped ${duplicates} duplicate row(s).`);
  }
  if (result.skipped > 0) {
    parts.push(
      `Skipped ${result.skipped} internal transfer row(s) — manage transfers on the Transfers page.`,
    );
  }
  return parts.join(" ");
}

type Options = {
  accountId: number;
  onSuccess: () => Promise<void>;
  setActionErr: (message: string | null) => void;
};

export function useCashLedgerImport(options: Options) {
  const { accountId, onSuccess, setActionErr } = options;
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [pendingImport, setPendingImport] = useState<PendingCashImport | null>(
    null,
  );
  const [pendingColumnMap, setPendingColumnMap] =
    useState<PendingColumnMap | null>(null);

  async function runImport(
    csv: string,
    categoryMappings: ImportCategoryMapping[],
    descriptionMappings: ImportDescriptionMapping[],
    columnMapping?: ColumnMapping,
  ) {
    setImportBusy(true);
    setActionErr(null);
    setImportMsg(null);
    try {
      const result = columnMapping
        ? await commitImportColumnMapping(
            accountId,
            csv,
            columnMapping,
            categoryMappings,
            descriptionMappings,
          )
        : await importTransactionsCsv(
            accountId,
            csv,
            categoryMappings,
            descriptionMappings,
          );
      setImportMsg(formatCashImportSuccessMessage(result));
      setPendingImport(null);
      setPendingColumnMap(null);
      await onSuccess();
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImportBusy(false);
    }
  }

  async function startColumnMappingFlow(csv: string) {
    const [columns, presets] = await Promise.all([
      previewImportColumns(accountId, csv),
      fetchImportPresets(accountId),
    ]);
    setPendingColumnMap({ csv, columns, presets });
  }

  async function reloadColumnPresets() {
    const presets = await fetchImportPresets(accountId);
    setPendingColumnMap((prev) => (prev ? { ...prev, presets } : null));
  }

  async function handleColumnMappingConfirm(mapping: ColumnMapping) {
    if (!pendingColumnMap) return;
    setImportBusy(true);
    setActionErr(null);
    setImportMsg(null);
    try {
      const preview = await applyImportColumnMapping(
        accountId,
        pendingColumnMap.csv,
        mapping,
      );
      setPendingColumnMap(null);
      if (!needsImportConfirm(preview)) {
        await runImport(pendingColumnMap.csv, [], [], mapping);
        return;
      }
      setPendingImport({
        csv: pendingColumnMap.csv,
        rowCount: preview.rowCount,
        categories: preview.categories,
        descriptionSuggestions: preview.descriptionSuggestions,
        skipped: preview.skipped,
        duplicateCount: preview.duplicateCount,
        skippedDuplicates: preview.skippedDuplicates,
        columnMapping: mapping,
      });
    } catch (err) {
      setActionErr(
        err instanceof Error ? err.message : "Column mapping failed",
      );
    } finally {
      setImportBusy(false);
    }
  }

  async function handleImportCsvFile(file: File) {
    setActionErr(null);
    setImportMsg(null);
    setPendingImport(null);
    setPendingColumnMap(null);
    setImportBusy(true);
    try {
      const csv = await file.text();
      try {
        const preview = await previewTransactionsImport(accountId, csv);
        if (!needsImportConfirm(preview)) {
          const result = await importTransactionsCsv(accountId, csv, [], []);
          setImportMsg(formatCashImportSuccessMessage(result));
          await onSuccess();
          return;
        }
        setPendingImport({
          csv,
          rowCount: preview.rowCount,
          categories: preview.categories,
          descriptionSuggestions: preview.descriptionSuggestions,
          skipped: preview.skipped,
          duplicateCount: preview.duplicateCount,
          skippedDuplicates: preview.skippedDuplicates,
        });
      } catch (err) {
        if (!isUnknownLedgerHeaderError(err)) throw err;
        await startColumnMappingFlow(csv);
      }
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImportBusy(false);
    }
  }

  return {
    importMsg,
    setImportMsg,
    importBusy,
    pendingImport,
    pendingColumnMap,
    setPendingImport,
    setPendingColumnMap,
    runImport,
    reloadColumnPresets,
    handleColumnMappingConfirm,
    handleImportCsvFile,
  };
}
