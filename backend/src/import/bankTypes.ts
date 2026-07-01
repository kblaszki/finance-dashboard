export type BankId = "mbank" | "generic";

export type ParsedBankRow = {
  row: number;
  date: Date;
  amount: number;
  currency: string;
  transactionType: "INCOME" | "EXPENSE";
  description: string;
  externalId?: string;
};

export type BankImportPreviewRow = {
  row: number;
  date: string;
  description: string;
  amount: number;
  transactionType: "INCOME" | "EXPENSE";
  currency: string;
};

export type BankImportResult = {
  dryRun: boolean;
  parsed: number;
  imported: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
  preview?: BankImportPreviewRow[];
  batchId?: number;
};
