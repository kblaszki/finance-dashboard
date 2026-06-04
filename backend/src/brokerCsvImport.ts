import { parseCsvText } from "./csvImport";

export type BrokerCsvColumnMapping = {
  dateColumn: string;
  symbolColumn: string;
  quantityColumn: string;
  priceColumn: string;
  sideColumn?: string;
};

export type ParsedBrokerCsvRow = {
  line: number;
  date: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  tradePrice: number;
};

function colIndex(headers: string[], name: string): number {
  const target = name.trim().toLowerCase();
  return headers.findIndex((h) => h.trim().toLowerCase() === target);
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseDate(raw: string): string | null {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dmy) {
    const dd = String(dmy[1]).padStart(2, "0");
    const mm = String(dmy[2]).padStart(2, "0");
    return `${dmy[3]}-${mm}-${dd}`;
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function parseSide(raw: string, amountSign?: number): "BUY" | "SELL" {
  const t = raw.trim().toLowerCase();
  if (t.includes("sell") || t.includes("sprzed") || t.includes("sprzedaż")) return "SELL";
  if (t.includes("buy") || t.includes("kup") || t.includes("zakup")) return "BUY";
  if (amountSign != null && amountSign < 0) return "SELL";
  return "BUY";
}

export function mapBrokerCsvRows(
  headers: string[],
  rows: string[][],
  mapping: BrokerCsvColumnMapping,
): { rows: ParsedBrokerCsvRow[]; errors: string[] } {
  const dateIdx = colIndex(headers, mapping.dateColumn);
  const symbolIdx = colIndex(headers, mapping.symbolColumn);
  const qtyIdx = colIndex(headers, mapping.quantityColumn);
  const priceIdx = colIndex(headers, mapping.priceColumn);
  const sideIdx = mapping.sideColumn ? colIndex(headers, mapping.sideColumn) : -1;

  const errors: string[] = [];
  if (dateIdx < 0) errors.push(`Column not found: ${mapping.dateColumn}`);
  if (symbolIdx < 0) errors.push(`Column not found: ${mapping.symbolColumn}`);
  if (qtyIdx < 0) errors.push(`Column not found: ${mapping.quantityColumn}`);
  if (priceIdx < 0) errors.push(`Column not found: ${mapping.priceColumn}`);
  if (errors.length) return { rows: [], errors };

  const parsed: ParsedBrokerCsvRow[] = [];
  rows.forEach((cells, i) => {
    const line = i + 2;
    const date = parseDate(cells[dateIdx] ?? "");
    const quantity = parseAmount(cells[qtyIdx] ?? "");
    const tradePrice = parseAmount(cells[priceIdx] ?? "");
    const symbol = String(cells[symbolIdx] ?? "").trim().toUpperCase();
    if (!date) {
      errors.push(`Line ${line}: invalid date`);
      return;
    }
    if (quantity == null || quantity <= 0) {
      errors.push(`Line ${line}: invalid quantity`);
      return;
    }
    if (tradePrice == null || tradePrice <= 0) {
      errors.push(`Line ${line}: invalid price`);
      return;
    }
    if (!symbol) {
      errors.push(`Line ${line}: missing symbol`);
      return;
    }
    const sideRaw = sideIdx >= 0 ? String(cells[sideIdx] ?? "") : "";
    const side = parseSide(sideRaw);
    parsed.push({ line, date, symbol, side, quantity, tradePrice });
  });

  return { rows: parsed, errors };
}

export function buildBrokerCsvPreview(
  csvText: string,
  mapping: BrokerCsvColumnMapping,
): {
  headers: string[];
  rows: ParsedBrokerCsvRow[];
  errors: string[];
  totalRows: number;
} {
  const { headers, rows } = parseCsvText(csvText);
  const result = mapBrokerCsvRows(headers, rows, mapping);
  return {
    headers,
    rows: result.rows.slice(0, 50),
    errors: result.errors.slice(0, 20),
    totalRows: result.rows.length,
  };
}
