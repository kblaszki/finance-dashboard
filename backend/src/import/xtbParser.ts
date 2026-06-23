/**
 * Selected broker: XTB (xStation)
 *
 * Supported exports:
 * 1. CLOSED POSITION HISTORY tab — trades with Volume / Open price (semicolon CSV)
 * 2. CASH OPERATION HISTORY tab — ID;Type;Time;Comment;Symbol;Amount (deposits, dividends, stock purchase/sale)
 *
 * Export: Account history → Cash operations or Closed positions → Export → CSV (semicolon).
 * Remove lines above the header and the Total row before import.
 */

import type { ImportError, ParsedImportRow } from "./types";
import { parseCsvTable, parseNumeric, rowToRecord } from "./csvParse";

function parseXtbDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const dotMatch = /^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(trimmed);
  if (dotMatch) {
    const [, dd, mm, yyyy, hh = "12", min = "0", sec = "0"] = dotMatch;
    return new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min), Number(sec)));
  }
  const iso = trimmed.replace(" ", "T");
  const d = new Date(iso.endsWith("Z") ? iso : `${iso}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function splitSymbol(raw: string): { symbol: string; exchange: string | null } {
  const trimmed = raw.trim();
  if (!trimmed) return { symbol: "", exchange: null };
  const dot = trimmed.lastIndexOf(".");
  if (dot > 0) {
    const base = trimmed.slice(0, dot).toUpperCase();
    const suffix = trimmed.slice(dot + 1).toUpperCase();
    const exchangeMap: Record<string, string> = {
      PL: "GPW",
      US: "NASDAQ",
      UK: "LSE",
      DE: "XETRA",
      FR: "EURONEXT",
    };
    return { symbol: base, exchange: exchangeMap[suffix] ?? suffix };
  }
  return { symbol: trimmed.toUpperCase(), exchange: null };
}

function inferCurrency(symbol: string, exchange: string | null, fallback: string): string {
  if (symbol.endsWith(".PL") || exchange === "GPW") return "PLN";
  if (exchange === "GPW") return "PLN";
  if (exchange === "XETRA" || exchange === "EURONEXT") return "EUR";
  if (exchange === "LSE") return "GBP";
  return fallback;
}

function isPurchaseType(type: string): boolean {
  const t = type.toLowerCase();
  return t.includes("stock purchase") || t.includes("stocks/etf purchase") || t.includes("zakup");
}

function isSaleType(type: string): boolean {
  const t = type.toLowerCase();
  return t.includes("stock sell") || t.includes("stocks/etf sale") || t.includes("sprzeda");
}

function isDividendType(type: string): boolean {
  const t = type.toLowerCase();
  return t.includes("divid") || t === "divident";
}

function isInterestType(type: string): boolean {
  const t = type.toLowerCase();
  return t.includes("free-funds interest") && !t.includes("tax");
}

function isDepositType(type: string): boolean {
  return /^deposit\b/i.test(type.trim());
}

function isWithdrawalType(type: string): boolean {
  return /^withdrawal\b/i.test(type.trim());
}

function parseTradeFromComment(
  comment: string,
  amount: number,
): { quantity: number; pricePerUnit: number } | null {
  const atMatch = /(\d+(?:[.,]\d+)?)\s*@\s*(\d+(?:[.,]\d+)?)/i.exec(comment);
  if (atMatch) {
    const quantity = parseNumeric(atMatch[1]);
    const pricePerUnit = parseNumeric(atMatch[2]);
    if (quantity != null && pricePerUnit != null && quantity > 0 && pricePerUnit > 0) {
      return { quantity, pricePerUnit };
    }
  }
  const qtyMatch = /(\d+(?:[.,]\d+)?)\s*(?:szt|shares|units)/i.exec(comment);
  if (qtyMatch) {
    const quantity = parseNumeric(qtyMatch[1]);
    if (quantity != null && quantity > 0) {
      return { quantity, pricePerUnit: amount / quantity };
    }
  }
  return null;
}

function detectFormat(headers: string[]): "closed" | "cash" {
  const lower = headers.map((h) => h.toLowerCase());
  if (lower.some((h) => h.includes("volume")) && lower.some((h) => h.includes("open price"))) {
    return "closed";
  }
  return "cash";
}

function parseClosedPositions(
  headers: string[],
  rows: string[][],
  accountCurrency: string,
): { rows: ParsedImportRow[]; errors: ImportError[] } {
  const parsed: ParsedImportRow[] = [];
  const errors: ImportError[] = [];

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 1;
    const rec = rowToRecord(headers, rows[i]);
    const symbolRaw = rec.symbol ?? "";
    const { symbol, exchange } = splitSymbol(symbolRaw);
    if (!symbol) {
      errors.push({ row: rowNum, message: "Missing symbol" });
      continue;
    }

    const type = (rec.type ?? "").trim();
    const sideUpper = type.toUpperCase();
    let side: "BUY" | "SELL" | null = null;
    if (sideUpper.includes("BUY") || sideUpper.includes("KUPNO")) side = "BUY";
    else if (sideUpper.includes("SELL") || sideUpper.includes("SPRZEDA")) side = "SELL";
    if (!side) {
      errors.push({ row: rowNum, message: `Unknown trade type: ${type || "(empty)"}` });
      continue;
    }

    const quantity = parseNumeric(rec.volume ?? "");
    const pricePerUnit = parseNumeric(rec["open price"] ?? rec.openprice ?? "");
    const tradeDate = parseXtbDate(rec["open time"] ?? rec.opentime ?? "");
    if (quantity == null || quantity <= 0) {
      errors.push({ row: rowNum, message: "Invalid quantity" });
      continue;
    }
    if (pricePerUnit == null || pricePerUnit <= 0) {
      errors.push({ row: rowNum, message: "Invalid open price" });
      continue;
    }
    if (!tradeDate) {
      errors.push({ row: rowNum, message: "Invalid open time" });
      continue;
    }

    const currency = inferCurrency(symbolRaw, exchange, accountCurrency);
    const commission = parseNumeric(rec.commission ?? "");
    const positionId = rec.position ?? "";

    parsed.push({
      kind: "trade",
      row: rowNum,
      tradeDate,
      symbol,
      exchange,
      side,
      quantity,
      pricePerUnit,
      totalPrice: quantity * pricePerUnit,
      currency,
      fee: commission != null && commission > 0 ? commission : undefined,
      externalId: positionId ? `xtb:closed:${positionId}:${side}` : `xtb:closed:${rowNum}:${symbol}:${side}`,
    });
  }

  return { rows: parsed, errors };
}

function parseCashOperations(
  headers: string[],
  rows: string[][],
  accountCurrency: string,
): { rows: ParsedImportRow[]; errors: ImportError[] } {
  const parsed: ParsedImportRow[] = [];
  const errors: ImportError[] = [];

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 1;
    const rec = rowToRecord(headers, rows[i]);
    const type = (rec.type ?? "").trim();
    const id = (rec.id ?? "").trim();
    const date = parseXtbDate(rec.time ?? "");
    const symbolRaw = (rec.symbol ?? "").trim();
    const comment = (rec.comment ?? "").trim();
    const amountRaw = parseNumeric(rec.amount ?? "");
    if (!date) {
      errors.push({ row: rowNum, message: "Invalid time" });
      continue;
    }
    if (amountRaw == null) {
      errors.push({ row: rowNum, message: "Invalid amount" });
      continue;
    }
    const amount = Math.abs(amountRaw);
    const { symbol, exchange } = splitSymbol(symbolRaw);
    const currency = symbolRaw ? inferCurrency(symbolRaw, exchange, accountCurrency) : accountCurrency;
    const externalId = id ? `xtb:cash:${id}` : undefined;

    if (isPurchaseType(type) || isSaleType(type)) {
      if (!symbol) {
        errors.push({ row: rowNum, message: "Stock trade missing symbol" });
        continue;
      }
      const fromComment = parseTradeFromComment(comment, amount);
      const quantity = fromComment?.quantity ?? null;
      const pricePerUnit = fromComment?.pricePerUnit ?? null;
      if (quantity == null || pricePerUnit == null) {
        errors.push({
          row: rowNum,
          message:
            "Could not parse quantity/price from comment — use CLOSED POSITION HISTORY export or include qty @ price in comment",
        });
        continue;
      }
      parsed.push({
        kind: "trade",
        row: rowNum,
        tradeDate: date,
        symbol,
        exchange,
        side: isPurchaseType(type) ? "BUY" : "SELL",
        quantity,
        pricePerUnit,
        totalPrice: quantity * pricePerUnit,
        currency,
        externalId: externalId ?? `xtb:cash:${rowNum}:${symbol}`,
      });
      continue;
    }

    if (isDividendType(type)) {
      parsed.push({
        kind: "dividend",
        row: rowNum,
        date,
        symbol: symbol || undefined,
        amount,
        currency,
        description: comment || type,
        externalId,
      });
      continue;
    }

    if (isInterestType(type)) {
      parsed.push({
        kind: "interest",
        row: rowNum,
        date,
        amount,
        currency: accountCurrency,
        description: comment || type,
        externalId,
      });
      continue;
    }

    if (isDepositType(type)) {
      parsed.push({
        kind: "transfer_in",
        row: rowNum,
        date,
        amount,
        currency: accountCurrency,
        description: comment || type,
        externalId,
      });
      continue;
    }

    if (isWithdrawalType(type)) {
      parsed.push({
        kind: "transfer_out",
        row: rowNum,
        date,
        amount,
        currency: accountCurrency,
        description: comment || type,
        externalId,
      });
      continue;
    }

    errors.push({ row: rowNum, message: `Skipped unknown operation type: ${type || "(empty)"}` });
  }

  return { rows: parsed, errors };
}

export function parseXtbCsv(
  csvText: string,
  accountCurrency: string,
): { rows: ParsedImportRow[]; errors: ImportError[] } {
  const table = parseCsvTable(csvText);
  const format = detectFormat(table.headers);
  if (format === "closed") {
    return parseClosedPositions(table.headers, table.rows, accountCurrency);
  }
  return parseCashOperations(table.headers, table.rows, accountCurrency);
}
