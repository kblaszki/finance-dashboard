import { apiClient } from "./client";

export type CsvColumnMapping = {
  dateColumn: string;
  amountColumn: string;
  descriptionColumn?: string;
  typeColumn?: string;
};

export type CsvPresetId = "mbank" | "ing" | "generic_pl";

export type CsvPreset = {
  id: CsvPresetId;
  label: string;
  mapping: CsvColumnMapping;
};

export type CsvPreviewRow = {
  line: number;
  date: string;
  amount: number;
  description: string;
  type: "INCOME" | "EXPENSE";
};

export type CsvPreviewResult = {
  headers: string[];
  rows: CsvPreviewRow[];
  errors: string[];
  totalRows: number;
  incomeSum: number;
  expenseSum: number;
};

export type BrokerCsvColumnMapping = {
  dateColumn: string;
  symbolColumn: string;
  quantityColumn: string;
  priceColumn: string;
  sideColumn?: string;
};

export type BrokerCsvPreviewRow = {
  line: number;
  date: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  tradePrice: number;
};

export function fetchCsvPresets() {
  return apiClient.get<CsvPreset[]>("/api/import/csv/presets");
}

export async function previewCsvImport(body: {
  csvText: string;
  mapping: CsvColumnMapping;
}): Promise<CsvPreviewResult> {
  return apiClient.post("/api/import/csv/preview", body);
}

export async function commitCsvImport(body: {
  csvText: string;
  mapping: CsvColumnMapping;
  accountId: number;
  categoryId?: number;
  defaultCategory?: string;
}): Promise<{ imported: number; skipped: number }> {
  return apiClient.post("/api/import/csv", body);
}

export async function previewBrokerCsvImport(body: {
  csvText: string;
  mapping: BrokerCsvColumnMapping;
}): Promise<{
  headers: string[];
  rows: BrokerCsvPreviewRow[];
  errors: string[];
  totalRows: number;
}> {
  return apiClient.post("/api/import/broker-csv/preview", body);
}

export async function commitBrokerCsvImport(body: {
  csvText: string;
  mapping: BrokerCsvColumnMapping;
  portfolioId: number;
}): Promise<{ imported: number; skipped: number; errors: string[] }> {
  return apiClient.post("/api/import/broker-csv", body);
}
