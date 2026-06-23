import { createHash } from "node:crypto";
import type { ParsedImportRow, ParsedTrade, ImportPreviewRow } from "./types";

export function rowExternalHash(accountId: number, broker: string, row: ParsedImportRow): string {
  const parts: string[] = [String(accountId), broker];
  if (row.externalId) {
    parts.push(row.externalId);
  } else if (row.kind === "trade") {
    parts.push(
      row.symbol,
      row.side,
      row.tradeDate.toISOString(),
      String(row.quantity),
      String(row.pricePerUnit),
    );
  } else {
    parts.push(row.kind, row.date.toISOString(), String(row.amount), row.currency);
  }
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

export function toPreviewRow(row: ParsedImportRow): ImportPreviewRow {
  if (row.kind === "trade") {
    return {
      row: row.row,
      kind: "trade",
      tradeDate: row.tradeDate.toISOString(),
      symbol: row.symbol,
      side: row.side,
      quantity: row.quantity,
      price: row.pricePerUnit,
      amount: row.totalPrice,
      currency: row.currency,
    };
  }
  return {
    row: row.row,
    kind: row.kind,
    tradeDate: row.date.toISOString(),
    symbol: row.symbol ?? null,
    side: null,
    quantity: null,
    price: null,
    amount: row.amount,
    currency: row.currency,
  };
}

export function tradeTransactionCategory(side: ParsedTrade["side"]): string {
  return side === "BUY" ? "TRADE_BUY" : "TRADE_SELL";
}
