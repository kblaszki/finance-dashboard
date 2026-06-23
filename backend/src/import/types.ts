export type BrokerId = "xtb";

export type ParsedRowKind = "trade" | "dividend" | "interest" | "transfer_in" | "transfer_out";

export type ParsedTrade = {
  kind: "trade";
  row: number;
  tradeDate: Date;
  symbol: string;
  exchange: string | null;
  side: "BUY" | "SELL";
  quantity: number;
  pricePerUnit: number;
  totalPrice: number;
  currency: string;
  fee?: number;
  externalId?: string;
};

export type ParsedCashEvent = {
  kind: "dividend" | "interest" | "transfer_in" | "transfer_out";
  row: number;
  date: Date;
  symbol?: string;
  amount: number;
  currency: string;
  description?: string;
  externalId?: string;
};

export type ParsedImportRow = ParsedTrade | ParsedCashEvent;

export type ImportPreviewRow = {
  row: number;
  kind: ParsedRowKind;
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
