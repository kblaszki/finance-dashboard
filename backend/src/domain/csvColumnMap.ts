import { badRequest } from "../lib/errors";
import { CASH_TX_TYPES, type CashTxType } from "./cashLedger";
import {
  type CashLedgerImportDraft,
  type ImportRowError,
  type ParseImportResult,
  stripBom,
} from "./cashLedgerCsvImport";
import { parseCategoryPath } from "./cashLedgerCsv";

export type AmountSignMode = "negativeIsExpense" | "negativeIsIncome";

export type ColumnMapping = {
  /** 0-based column index. */
  occurredAt: number;
  amount: number;
  description?: number | null;
  type?: number | null;
  categoryPath?: number | null;
  /**
   * Required when `type` is not mapped. Ignored when `type` is mapped.
   * negativeIsExpense: bank ROR (debit negative).
   * negativeIsIncome: credit-card style (charges positive).
   */
  amountSignMode?: AmountSignMode;
};

export type DelimitedTable = {
  delimiter: string;
  headers: string[];
  rows: string[][];
};

export type SuggestedColumnMapping = {
  occurredAt: number | null;
  amount: number | null;
  description: number | null;
  type: number | null;
  categoryPath: number | null;
  amountSignMode: AmountSignMode;
};

const AMOUNT_HINTS = ["amount", "kwota", "value", "suma", "sum", "wartosc", "wartość"];
const DATE_HINTS = [
  "date",
  "data",
  "occurred",
  "booking",
  "posted",
  "when",
  "dzień",
  "dzien",
];
const DESC_HINTS = [
  "description",
  "desc",
  "title",
  "tytul",
  "tytuł",
  "narr",
  "memo",
  "details",
  "opis",
];
const TYPE_HINTS = ["type", "typ", "rodzaj", "direction"];
const CATEGORY_HINTS = ["category", "kategoria", "path", "tag"];

/**
 * Detect delimiter and parse header + data rows (RFC4180-ish quoting).
 */
export function parseDelimitedTable(csv: string): DelimitedTable {
  const text = stripBom(String(csv ?? "")).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!text.trim()) {
    throw badRequest("CSV is empty");
  }
  const firstLineEnd = text.indexOf("\n");
  const firstLine = firstLineEnd < 0 ? text : text.slice(0, firstLineEnd);
  const delimiter = detectDelimiter(firstLine);
  const records = splitDelimitedRecords(text, delimiter);
  if (records.length === 0) {
    throw badRequest("CSV header required");
  }
  const headers = records[0]!.map((h) => h.trim());
  if (headers.length === 0 || headers.every((h) => h === "")) {
    throw badRequest("CSV header required");
  }
  const rows = records.slice(1).filter((row) => !(row.length === 1 && row[0] === ""));
  return { delimiter, headers, rows };
}

export function detectDelimiter(headerLine: string): string {
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  let inQuotes = false;
  for (let i = 0; i < headerLine.length; i++) {
    const ch = headerLine[i]!;
    if (ch === '"') {
      if (inQuotes && headerLine[i + 1] === '"') {
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && (ch === "," || ch === ";" || ch === "\t")) {
      counts[ch] = (counts[ch] ?? 0) + 1;
    }
  }
  let best: string = ",";
  let bestCount = -1;
  for (const d of [",", ";", "\t"] as const) {
    if (counts[d]! > bestCount) {
      best = d;
      bestCount = counts[d]!;
    }
  }
  return best;
}

export function splitDelimitedRecords(text: string, delimiter: string): string[][] {
  const records: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === delimiter) {
      row.push(cell);
      cell = "";
      i += 1;
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      cell = "";
      records.push(row);
      row = [];
      i += 1;
      continue;
    }
    cell += ch;
    i += 1;
  }

  if (inQuotes) {
    row.push(cell);
    records.push(row);
    return records;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    records.push(row);
  }

  while (
    records.length > 1 &&
    records[records.length - 1]!.length === 1 &&
    records[records.length - 1]![0] === ""
  ) {
    records.pop();
  }

  return records;
}

export function suggestColumnMapping(headers: string[]): SuggestedColumnMapping {
  return {
    occurredAt: findHintIndex(headers, DATE_HINTS),
    amount: findHintIndex(headers, AMOUNT_HINTS),
    description: findHintIndex(headers, DESC_HINTS),
    type: findHintIndex(headers, TYPE_HINTS),
    categoryPath: findHintIndex(headers, CATEGORY_HINTS),
    amountSignMode: "negativeIsExpense",
  };
}

function findHintIndex(headers: string[], hints: string[]): number | null {
  const normalized = headers.map((h) => h.trim().toLowerCase());
  for (let i = 0; i < normalized.length; i++) {
    const h = normalized[i]!;
    if (hints.some((hint) => h === hint || h.includes(hint))) {
      return i;
    }
  }
  return null;
}

/**
 * Parse API columnMapping: column refs are 0-based index or header name.
 */
export function parseColumnMapping(
  raw: unknown,
  headers: string[],
): ColumnMapping {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    throw badRequest("columnMapping object required");
  }
  const body = raw as Record<string, unknown>;
  const occurredAt = resolveColumnRef(body.occurredAt, headers, "occurredAt");
  const amount = resolveColumnRef(body.amount, headers, "amount");
  const description =
    body.description === undefined || body.description === null
      ? null
      : resolveColumnRef(body.description, headers, "description");
  const type =
    body.type === undefined || body.type === null
      ? null
      : resolveColumnRef(body.type, headers, "type");
  const categoryPath =
    body.categoryPath === undefined || body.categoryPath === null
      ? null
      : resolveColumnRef(body.categoryPath, headers, "categoryPath");

  let amountSignMode: AmountSignMode | undefined;
  if (body.amountSignMode !== undefined && body.amountSignMode !== null) {
    const mode = String(body.amountSignMode);
    if (mode !== "negativeIsExpense" && mode !== "negativeIsIncome") {
      throw badRequest(
        'amountSignMode must be "negativeIsExpense" or "negativeIsIncome"',
      );
    }
    amountSignMode = mode;
  }

  if (type == null && amountSignMode == null) {
    throw badRequest(
      "amountSignMode is required when type column is not mapped",
    );
  }

  const used = new Set<number>([occurredAt, amount]);
  for (const idx of [description, type, categoryPath]) {
    if (idx == null) continue;
    if (used.has(idx)) {
      throw badRequest("columnMapping fields must use distinct columns");
    }
    used.add(idx);
  }

  return {
    occurredAt,
    amount,
    description,
    type,
    categoryPath,
    amountSignMode,
  };
}

function resolveColumnRef(
  value: unknown,
  headers: string[],
  field: string,
): number {
  if (typeof value === "number" && Number.isInteger(value)) {
    if (value < 0 || value >= headers.length) {
      throw badRequest(`${field} column index out of range`);
    }
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) {
      return resolveColumnRef(Number(trimmed), headers, field);
    }
    const idx = headers.findIndex(
      (h) => h.trim().toLowerCase() === trimmed.toLowerCase(),
    );
    if (idx < 0) {
      throw badRequest(`${field} column "${trimmed}" not found in CSV header`);
    }
    return idx;
  }
  throw badRequest(`${field} must be a column index or header name`);
}

/**
 * Map arbitrary CSV rows into cash ledger drafts using columnMapping.
 */
export function normalizeMappedRows(
  table: DelimitedTable,
  mapping: ColumnMapping,
): ParseImportResult {
  const errors: ImportRowError[] = [];
  const drafts: CashLedgerImportDraft[] = [];
  const colCount = table.headers.length;

  for (let i = 0; i < table.rows.length; i++) {
    const cells = table.rows[i]!;
    const dataRow = i + 1;
    if (cells.length === 1 && cells[0] === "") continue;
    if (cells.length < colCount) {
      // pad short rows
      while (cells.length < colCount) cells.push("");
    }

    const occurredRaw = (cells[mapping.occurredAt] ?? "").trim();
    if (!occurredRaw) {
      errors.push({ row: dataRow, message: "occurredAt is required" });
      continue;
    }
    const occurredAt = parseFlexibleDate(occurredRaw);
    if (!occurredAt) {
      errors.push({
        row: dataRow,
        message: "occurredAt must be a valid date",
      });
      continue;
    }

    const amountRaw = (cells[mapping.amount] ?? "").trim();
    const signed = parseSignedAmount(amountRaw);
    if (signed == null || signed === 0 || !Number.isFinite(signed)) {
      errors.push({
        row: dataRow,
        message: "amount must be a non-zero number",
      });
      continue;
    }
    const amount = Math.abs(signed);
    // keep 2 decimal places max via string round-trip
    const amountRounded = Number(amount.toFixed(2));
    if (amountRounded <= 0) {
      errors.push({
        row: dataRow,
        message: "amount must be a non-zero number",
      });
      continue;
    }

    let type: CashTxType;
    if (mapping.type != null) {
      const typeRaw = (cells[mapping.type] ?? "").trim().toUpperCase();
      if (typeRaw !== "INCOME" && typeRaw !== "EXPENSE") {
        errors.push({
          row: dataRow,
          message: `type must be one of: ${CASH_TX_TYPES.join(", ")}`,
        });
        continue;
      }
      type = typeRaw;
    } else {
      const mode = mapping.amountSignMode ?? "negativeIsExpense";
      if (mode === "negativeIsExpense") {
        type = signed < 0 ? "EXPENSE" : "INCOME";
      } else {
        type = signed < 0 ? "INCOME" : "EXPENSE";
      }
    }

    let description: string | null = null;
    if (mapping.description != null) {
      const d = (cells[mapping.description] ?? "").trim();
      description = d.length ? d : null;
    }

    let categoryPath: string[] | null = null;
    if (mapping.categoryPath != null) {
      const pathRaw = cells[mapping.categoryPath] ?? "";
      const pathResult = parseCategoryPath(pathRaw);
      if (!pathResult.ok) {
        errors.push({ row: dataRow, message: pathResult.message });
        continue;
      }
      categoryPath =
        pathResult.segments.length === 0 ? null : pathResult.segments;
    }

    drafts.push({
      row: dataRow,
      type,
      amount: amountRounded,
      occurredAt,
      description,
      categoryPath,
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, drafts, skippedTransfers: [] };
}

export function parseFlexibleDate(raw: string): Date | null {
  const t = raw.trim();
  const dmy = /^(\d{1,2})[./](\d{1,2})[./](\d{4})(?:[T\s].*)?$/.exec(t);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    const dt = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    if (
      dt.getUTCFullYear() !== year ||
      dt.getUTCMonth() !== month - 1 ||
      dt.getUTCDate() !== day
    ) {
      return null;
    }
    return dt;
  }
  const isoDay = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (isoDay) {
    const year = Number(isoDay[1]);
    const month = Number(isoDay[2]);
    const day = Number(isoDay[3]);
    const dt = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    if (
      dt.getUTCFullYear() !== year ||
      dt.getUTCMonth() !== month - 1 ||
      dt.getUTCDate() !== day
    ) {
      return null;
    }
    return dt;
  }
  const parsed = new Date(t);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

/** Parse major-unit amount; supports EU decimal comma. Returns signed number or null. */
export function parseSignedAmount(raw: string): number | null {
  let s = raw.trim().replace(/\s/g, "").replace(/^\+/, "");
  if (!s) return null;
  if (s.includes(",") && s.includes(".")) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return n;
}
