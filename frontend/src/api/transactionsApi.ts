import { apiClient } from "./client";

export const CASH_TX_TYPES = ["INCOME", "EXPENSE"] as const;

export type CashTxType = (typeof CASH_TX_TYPES)[number];

export type CashTransaction = {
  id: number;
  accountId: number;
  type: CashTxType | "TRANSFER_IN" | "TRANSFER_OUT" | string;
  amount: number;
  occurredAt: string;
  description: string | null;
  categoryId: number | null;
  tagIds: number[];
  transferId: number | null;
  createdAt: string;
};

export type CreateCashTransactionInput = {
  type: CashTxType;
  amount: number;
  occurredAt?: string;
  description?: string | null;
  categoryId?: number | null;
  tagIds?: number[];
};

export type TransactionListPage = {
  items: CashTransaction[];
  nextCursor: string | null;
};

export type FetchTransactionsOptions = {
  month?: string;
  limit?: number;
  cursor?: string | null;
};

function transactionsQuery(options?: FetchTransactionsOptions): string {
  const params = new URLSearchParams();
  if (options?.month) params.set("month", options.month);
  if (options?.limit != null) params.set("limit", String(options.limit));
  if (options?.cursor) params.set("cursor", options.cursor);
  const q = params.toString();
  return q ? `?${q}` : "";
}

export async function fetchTransactions(
  accountId: number,
  options?: FetchTransactionsOptions,
): Promise<TransactionListPage> {
  return apiClient.get<TransactionListPage>(
    `/api/accounts/${accountId}/transactions${transactionsQuery(options)}`,
  );
}

export async function createTransaction(
  accountId: number,
  input: CreateCashTransactionInput,
): Promise<CashTransaction> {
  return apiClient.post<CashTransaction>(
    `/api/accounts/${accountId}/transactions`,
    input,
  );
}

export async function updateTransaction(
  accountId: number,
  id: number,
  input: Partial<CreateCashTransactionInput>,
): Promise<CashTransaction> {
  return apiClient.patch<CashTransaction>(
    `/api/accounts/${accountId}/transactions/${id}`,
    input,
  );
}

export async function deleteTransaction(
  accountId: number,
  id: number,
): Promise<void> {
  await apiClient.delete(`/api/accounts/${accountId}/transactions/${id}`);
}

export async function exportTransactionsCsv(accountId: number): Promise<Blob> {
  return apiClient.getBlob(`/api/accounts/${accountId}/transactions/export`);
}

export type ImportCategoryPreview = {
  path: string;
  ledgerType: CashTxType;
  rowCount: number;
  suggestedCategoryId: number | null;
};

export type SkippedTransferRow = {
  row: number;
  type: "TRANSFER_IN" | "TRANSFER_OUT";
  message: string;
};

export type SkippedDuplicateRow = {
  row: number;
  type: CashTxType;
  amount: number;
  occurredAt: string;
  description: string | null;
  message: string;
};

export type ImportPreviewResult = {
  rowCount: number;
  categories: ImportCategoryPreview[];
  skipped: number;
  skippedTransfers: SkippedTransferRow[];
  duplicateCount: number;
  skippedDuplicates: SkippedDuplicateRow[];
};

export type ImportCategoryMapping =
  | {
      path: string;
      ledgerType: CashTxType;
      action: "map";
      categoryId: number;
    }
  | {
      path: string;
      ledgerType: CashTxType;
      action: "create";
    }
  | {
      path: string;
      ledgerType: CashTxType;
      action: "none";
    };

export type ImportTransactionsResult = {
  created: number;
  createdCategories: number;
  skipped: number;
  skippedTransfers: SkippedTransferRow[];
  duplicateCount: number;
  skippedDuplicates: SkippedDuplicateRow[];
};

export async function previewTransactionsImport(
  accountId: number,
  csv: string,
): Promise<ImportPreviewResult> {
  return apiClient.post<ImportPreviewResult>(
    `/api/accounts/${accountId}/transactions/import/preview`,
    { csv },
  );
}

export async function importTransactionsCsv(
  accountId: number,
  csv: string,
  categoryMappings: ImportCategoryMapping[],
): Promise<ImportTransactionsResult> {
  return apiClient.post<ImportTransactionsResult>(
    `/api/accounts/${accountId}/transactions/import`,
    { csv, categoryMappings },
  );
}

export type AmountSignMode = "negativeIsExpense" | "negativeIsIncome";

export type SuggestedColumnMapping = {
  occurredAt: number | null;
  amount: number | null;
  description: number | null;
  type: number | null;
  categoryPath: number | null;
  amountSignMode: AmountSignMode;
};

export type ColumnMapping = {
  occurredAt: number;
  amount: number;
  description?: number | null;
  type?: number | null;
  categoryPath?: number | null;
  amountSignMode?: AmountSignMode;
};

export type ImportColumnsPreview = {
  delimiter: string;
  headers: string[];
  sampleRows: string[][];
  suggestedMapping: SuggestedColumnMapping;
  matchingPresetId: number | null;
};

export type NamedColumnMapping = {
  occurredAt: string;
  amount: string;
  description?: string | null;
  type?: string | null;
  categoryPath?: string | null;
  amountSignMode?: AmountSignMode;
};

export type CsvImportPreset = {
  id: number;
  accountId: number;
  name: string;
  mapping: NamedColumnMapping;
  createdAt: string;
  updatedAt: string;
};

export async function fetchImportPresets(
  accountId: number,
): Promise<CsvImportPreset[]> {
  return apiClient.get<CsvImportPreset[]>(
    `/api/accounts/${accountId}/import-presets`,
  );
}

export async function createImportPreset(
  accountId: number,
  input: {
    name: string;
    headers: string[];
    columnMapping: ColumnMapping;
  },
): Promise<CsvImportPreset> {
  return apiClient.post<CsvImportPreset>(
    `/api/accounts/${accountId}/import-presets`,
    input,
  );
}

export async function updateImportPreset(
  accountId: number,
  presetId: number,
  input: {
    name?: string;
    headers?: string[];
    columnMapping?: ColumnMapping;
  },
): Promise<CsvImportPreset> {
  return apiClient.patch<CsvImportPreset>(
    `/api/accounts/${accountId}/import-presets/${presetId}`,
    input,
  );
}

export async function deleteImportPreset(
  accountId: number,
  presetId: number,
): Promise<void> {
  return apiClient.delete(
    `/api/accounts/${accountId}/import-presets/${presetId}`,
  );
}

export async function previewImportColumns(
  accountId: number,
  csv: string,
): Promise<ImportColumnsPreview> {
  return apiClient.post<ImportColumnsPreview>(
    `/api/accounts/${accountId}/transactions/import/columns/preview`,
    { csv },
  );
}

export async function applyImportColumnMapping(
  accountId: number,
  csv: string,
  columnMapping: ColumnMapping,
): Promise<ImportPreviewResult> {
  return apiClient.post<ImportPreviewResult>(
    `/api/accounts/${accountId}/transactions/import/columns/apply`,
    { csv, columnMapping },
  );
}

export async function commitImportColumnMapping(
  accountId: number,
  csv: string,
  columnMapping: ColumnMapping,
  categoryMappings: ImportCategoryMapping[],
): Promise<ImportTransactionsResult> {
  return apiClient.post<ImportTransactionsResult>(
    `/api/accounts/${accountId}/transactions/import/columns/commit`,
    { csv, columnMapping, categoryMappings },
  );
}
