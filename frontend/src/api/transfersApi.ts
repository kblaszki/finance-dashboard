import { apiClient } from "./client";

export type CashTransfer = {
  id: number;
  fromAccountId: number;
  toAccountId: number;
  fromCurrency: string;
  toCurrency: string;
  amountFrom: number;
  amountTo: number;
  fxRate: number | null;
  occurredAt: string;
  description: string | null;
  createdAt: string;
};

export type CreateTransferInput = {
  fromAccountId: number;
  toAccountId: number;
  amountFrom: number;
  amountTo?: number;
  occurredAt?: string;
  description?: string | null;
};

export type UpdateTransferInput = Partial<CreateTransferInput>;

export type TransferAccountPreview = {
  name: string;
  currency: string;
  rowCount: number;
  suggestedAccountId: number | null;
};

export type TransferImportRowPreview = {
  row: number;
  occurredAt: string;
  fromAccountId: number;
  toAccountId: number;
  amountFrom: number;
  amountTo: number;
  description: string | null;
  duplicate: boolean;
};

export type TransferImportPreview = {
  rowCount: number;
  accounts: TransferAccountPreview[];
  rows?: TransferImportRowPreview[];
};

export type TransferAccountMapping = {
  name: string;
  currency: string;
  accountId: number;
};

export type ImportTransfersResult = {
  created: number;
  skipped: number;
};

export async function fetchTransfers(): Promise<CashTransfer[]> {
  return apiClient.get<CashTransfer[]>("/api/transfers");
}

export async function createTransfer(
  input: CreateTransferInput,
): Promise<CashTransfer> {
  return apiClient.post<CashTransfer>("/api/transfers", input);
}

export async function updateTransfer(
  id: number,
  input: UpdateTransferInput,
): Promise<CashTransfer> {
  return apiClient.patch<CashTransfer>(`/api/transfers/${id}`, input);
}

export async function deleteTransfer(id: number): Promise<void> {
  await apiClient.delete(`/api/transfers/${id}`);
}

export async function exportTransfersCsv(): Promise<Blob> {
  return apiClient.getBlob("/api/transfers/export");
}

export async function previewTransfersImport(
  csv: string,
  accountMappings?: TransferAccountMapping[],
): Promise<TransferImportPreview> {
  return apiClient.post<TransferImportPreview>("/api/transfers/import/preview", {
    csv,
    ...(accountMappings !== undefined ? { accountMappings } : {}),
  });
}

export async function importTransfersCsv(
  csv: string,
  accountMappings: TransferAccountMapping[],
  skipRows: number[] = [],
): Promise<ImportTransfersResult> {
  return apiClient.post<ImportTransfersResult>("/api/transfers/import", {
    csv,
    accountMappings,
    skipRows,
  });
}
