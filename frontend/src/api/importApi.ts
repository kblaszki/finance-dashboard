import { apiClient } from "./client";

export type CsvColumnMapping = {
  dateColumn: string;
  amountColumn: string;
  descriptionColumn?: string;
  typeColumn?: string;
};

export type CsvPreviewRow = {
  line: number;
  date: string;
  amount: number;
  description: string;
  type: "INCOME" | "EXPENSE";
};

export async function previewCsvImport(body: {
  csvText: string;
  mapping: CsvColumnMapping;
}): Promise<{ headers: string[]; rows: CsvPreviewRow[]; errors: string[] }> {
  return apiClient.post("/api/import/csv/preview", body);
}

export async function commitCsvImport(body: {
  csvText: string;
  mapping: CsvColumnMapping;
  accountId: number;
  categoryId?: number;
  defaultCategory?: string;
}): Promise<{ imported: number }> {
  return apiClient.post("/api/import/csv", body);
}
