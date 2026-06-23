import { apiClient } from "./client";

export type ImportPreviewRow = {
  row: number;
  kind: string;
  tradeDate: string;
  symbol: string | null;
  side: string | null;
  quantity: number | null;
  price: number | null;
  amount: number | null;
  currency: string;
};

export type ImportError = { row: number; message: string };

export type ImportResult = {
  dryRun: boolean;
  parsed: number;
  imported: number;
  skipped: number;
  errors: ImportError[];
  preview?: ImportPreviewRow[];
};

export type BrokerImportInput = {
  accountId: number;
  broker?: "xtb";
  csv: string;
  filename?: string;
  dryRun?: boolean;
};

export async function importBrokerTrades(input: BrokerImportInput): Promise<ImportResult> {
  const params = new URLSearchParams({
    accountId: String(input.accountId),
    broker: input.broker ?? "xtb",
  });
  if (input.dryRun) params.set("dryRun", "true");
  return apiClient.post<ImportResult>(`/api/import/broker-trades?${params.toString()}`, {
    csv: input.csv,
    filename: input.filename,
    dryRun: input.dryRun,
  });
}
