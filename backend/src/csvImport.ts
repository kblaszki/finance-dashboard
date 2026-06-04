import { createHash } from "crypto";

export type CsvColumnMapping = {
  dateColumn: string;
  amountColumn: string;
  descriptionColumn?: string;
  typeColumn?: string;
};

export type ParsedCsvRow = {
  line: number;
  date: string;
  amount: number;
  description: string;
  type: "INCOME" | "EXPENSE";
};

export const CSV_PREVIEW_MAX_ROWS = 50;
export const CSV_PREVIEW_MAX_ERRORS = 20;

export type CsvPreviewSummary = {
  headers: string[];
  rows: ParsedCsvRow[];
  errors: string[];
  totalRows: number;
  incomeSum: number;
  expenseSum: number;
};

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

export function parseCsvText(text: string): { headers: string[]; rows: string[][] } {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]!).map((h) => h.trim());
  const rows = lines.slice(1).map(parseCsvLine);
  return { headers, rows };
}

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
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return null;
}

export function mapCsvRows(
  headers: string[],
  rows: string[][],
  mapping: CsvColumnMapping,
): { rows: ParsedCsvRow[]; errors: string[] } {
  const dateIdx = colIndex(headers, mapping.dateColumn);
  const amountIdx = colIndex(headers, mapping.amountColumn);
  const descIdx = mapping.descriptionColumn
    ? colIndex(headers, mapping.descriptionColumn)
    : -1;
  const typeIdx = mapping.typeColumn ? colIndex(headers, mapping.typeColumn) : -1;

  const errors: string[] = [];
  if (dateIdx < 0) errors.push(`Column not found: ${mapping.dateColumn}`);
  if (amountIdx < 0) errors.push(`Column not found: ${mapping.amountColumn}`);
  if (errors.length) return { rows: [], errors };

  const parsed: ParsedCsvRow[] = [];
  rows.forEach((cells, i) => {
    const line = i + 2;
    const dateRaw = cells[dateIdx] ?? "";
    const amountRaw = cells[amountIdx] ?? "";
    const date = parseDate(dateRaw);
    const amount = parseAmount(amountRaw);
    if (!date) {
      errors.push(`Line ${line}: invalid date`);
      return;
    }
    if (amount == null) {
      errors.push(`Line ${line}: invalid amount`);
      return;
    }
    let type: "INCOME" | "EXPENSE" = amount >= 0 ? "INCOME" : "EXPENSE";
    if (typeIdx >= 0) {
      const t = String(cells[typeIdx] ?? "").toLowerCase();
      if (t.includes("wydatek") || t.includes("expense") || t.includes("obciąż")) type = "EXPENSE";
      if (t.includes("przych") || t.includes("income") || t.includes("uznan")) type = "INCOME";
    }
    const absAmount = Math.abs(amount);
    parsed.push({
      line,
      date,
      amount: absAmount,
      description: descIdx >= 0 ? String(cells[descIdx] ?? "").trim() : "",
      type,
    });
  });

  return { rows: parsed, errors };
}

export function buildCsvPreview(
  headers: string[],
  rows: string[][],
  mapping: CsvColumnMapping,
): CsvPreviewSummary {
  const result = mapCsvRows(headers, rows, mapping);
  const previewRows = result.rows.slice(0, CSV_PREVIEW_MAX_ROWS);
  const errors = result.errors.slice(0, CSV_PREVIEW_MAX_ERRORS);
  let incomeSum = 0;
  let expenseSum = 0;
  for (const row of result.rows) {
    if (row.type === "INCOME") incomeSum += row.amount;
    else expenseSum += row.amount;
  }
  return {
    headers,
    rows: previewRows,
    errors,
    totalRows: result.rows.length,
    incomeSum: Math.round(incomeSum * 100) / 100,
    expenseSum: Math.round(expenseSum * 100) / 100,
  };
}

export function computeTransactionImportHash(
  accountId: number,
  row: Pick<ParsedCsvRow, "date" | "amount" | "description" | "type">,
): string {
  const amountKey = row.amount.toFixed(2);
  const desc = row.description.trim();
  const payload = `${accountId}|${row.date}|${amountKey}|${desc}|${row.type}`;
  return createHash("sha256").update(payload).digest("hex");
}
