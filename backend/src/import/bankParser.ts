import { createHash } from "node:crypto";
import { parseNumeric } from "./csvParse";
import type { BankId, ParsedBankRow } from "./bankTypes";

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function detectDelimiter(headerLine: string): string {
  const semicolons = (headerLine.match(/;/g) ?? []).length;
  const commas = (headerLine.match(/,/g) ?? []).length;
  return semicolons >= commas ? ";" : ",";
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && ch === delimiter) {
      fields.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  fields.push(current.trim());
  return fields;
}

function normalizeHeader(value: string): string {
  return value.replace(/^#/, "").trim().toLowerCase();
}

const DATE_KEYS = ["data operacji", "data", "date", "booking date", "transaction date"];
const AMOUNT_KEYS = ["kwota", "amount", "value", "suma"];
const DESC_KEYS = ["opis operacji", "opis", "description", "title", "tytuł", "tytul"];

function findColumn(headers: string[], keys: string[]): number {
  const normalized = headers.map(normalizeHeader);
  for (const key of keys) {
    const idx = normalized.findIndex((h) => h === key || h.includes(key));
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const iso = /^\d{4}-\d{2}-\d{2}/.test(trimmed);
  if (iso) {
    const d = new Date(trimmed.slice(0, 10) + "T12:00:00.000Z");
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const pl = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (pl) {
    const [, dd, mm, yyyy] = pl;
    const d = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), 12));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d;
}

function bankRowHash(date: Date, amount: number, description: string): string {
  const day = date.toISOString().slice(0, 10);
  return createHash("sha256").update(`${day}|${amount}|${description}`).digest("hex").slice(0, 32);
}

function parseBankTable(text: string): { headers: string[]; rows: string[][] } {
  const normalized = stripBom(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const lower = normalizeHeader(lines[i]!);
    if (
      DATE_KEYS.some((k) => lower.includes(k)) &&
      AMOUNT_KEYS.some((k) => lower.includes(k))
    ) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) {
    throw new Error("Could not find CSV header row (expected date and amount columns)");
  }

  const delimiter = detectDelimiter(lines[headerIdx]!);
  const headers = parseCsvLine(lines[headerIdx]!, delimiter);
  const rows: string[][] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (/^total\b/i.test(line)) continue;
    const fields = parseCsvLine(line, delimiter);
    if (fields.every((f) => f === "")) continue;
    rows.push(fields);
  }
  return { headers, rows };
}

function rowsFromTable(
  headers: string[],
  rows: string[][],
  currency: string,
  errors: Array<{ row: number; message: string }>,
): ParsedBankRow[] {
  const dateCol = findColumn(headers, DATE_KEYS);
  const amountCol = findColumn(headers, AMOUNT_KEYS);
  const descCol = findColumn(headers, DESC_KEYS);
  if (dateCol < 0 || amountCol < 0) {
    throw new Error("CSV must include date and amount columns");
  }

  const parsed: ParsedBankRow[] = [];
  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 1;
    const fields = rows[i]!;
    const date = parseDate(fields[dateCol] ?? "");
    const rawAmount = parseNumeric(fields[amountCol] ?? "");
    if (!date) {
      errors.push({ row: rowNum, message: "Invalid date" });
      continue;
    }
    if (rawAmount == null || rawAmount === 0) {
      errors.push({ row: rowNum, message: "Invalid amount" });
      continue;
    }
    const description =
      (descCol >= 0 ? (fields[descCol] ?? "") : fields.join(" ")).trim() || "Import";
    const amount = Math.abs(rawAmount);
    const transactionType = rawAmount < 0 ? "EXPENSE" : "INCOME";
    parsed.push({
      row: rowNum,
      date,
      amount,
      currency,
      transactionType,
      description,
      externalId: bankRowHash(date, amount, description),
    });
  }
  return parsed;
}

export function parseBankCsv(
  bank: BankId,
  csvText: string,
  accountCurrency: string,
): { rows: ParsedBankRow[]; errors: Array<{ row: number; message: string }> } {
  const errors: Array<{ row: number; message: string }> = [];
  if (bank !== "mbank" && bank !== "generic") {
    throw new Error(`Unsupported bank preset: ${bank}`);
  }
  const { headers, rows } = parseBankTable(csvText);
  const parsed = rowsFromTable(headers, rows, accountCurrency, errors);
  return { rows: parsed, errors };
}
