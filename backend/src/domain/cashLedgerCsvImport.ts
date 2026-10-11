import { CASH_TX_TYPES, parsePositiveAmount, type CashTxType } from "./cashLedger";
import {
  CASH_LEDGER_CSV_HEADER,
  LEGACY_CASH_LEDGER_CSV_HEADER,
  parseCategoryPath,
} from "./cashLedgerCsv";

const HEADER_COLUMNS = CASH_LEDGER_CSV_HEADER.split(",");

export type ImportRowError = {
  row: number;
  message: string;
};

/** One validated CSV data row before category mapping. */
export type CashLedgerImportDraft = {
  /** 1-based data row index (header excluded). */
  row: number;
  type: CashTxType;
  amount: number;
  occurredAt: Date;
  description: string | null;
  /** Path segments; null means uncategorized in the file. */
  categoryPath: string[] | null;
};

export type CashLedgerImportResolved = {
  row: number;
  type: CashTxType;
  amount: number;
  occurredAt: Date;
  description: string | null;
  categoryId: number | null;
};

export type ParseImportResult =
  | { ok: true; drafts: CashLedgerImportDraft[] }
  | { ok: false; errors: ImportRowError[] };

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function unescapeImportedFormula(value: string): string {
  if (value.startsWith("'") && FORMULA_PREFIX.test(value.slice(1))) {
    return value.slice(1);
  }
  return value;
}

/**
 * Parse and validate cash-ledger CSV (export format). Ignores id and createdAt.
 * Category paths are not resolved here — use import preview + categoryMappings.
 */
export function parseCashLedgerCsvImport(
  csv: string,
  accountCurrency: string,
): ParseImportResult {
  const text = stripBom(String(csv ?? "")).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = splitCsvRecords(text);
  if (lines.length === 0) {
    return { ok: false, errors: [{ row: 0, message: "CSV header required" }] };
  }

  const headerJoined = lines[0]!.join(",");
  if (headerJoined === LEGACY_CASH_LEDGER_CSV_HEADER) {
    return {
      ok: false,
      errors: [
        {
          row: 0,
          message:
            "Legacy CSV header (categoryId/categoryName) is no longer supported; re-export the file from the account ledger",
        },
      ],
    };
  }
  if (headerJoined !== CASH_LEDGER_CSV_HEADER) {
    return {
      ok: false,
      errors: [
        {
          row: 0,
          message: `CSV header must be: ${CASH_LEDGER_CSV_HEADER}`,
        },
      ],
    };
  }

  const expectedCurrency = String(accountCurrency || "").trim().toUpperCase();
  const errors: ImportRowError[] = [];
  const drafts: CashLedgerImportDraft[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i]!;
    const dataRow = i; // 1-based data row index
    if (cells.length === 1 && cells[0] === "") {
      continue; // trailing blank line
    }
    if (cells.length !== HEADER_COLUMNS.length) {
      errors.push({
        row: dataRow,
        message: `expected ${HEADER_COLUMNS.length} columns, got ${cells.length}`,
      });
      continue;
    }

    const typeRaw = cells[1]!.trim();
    const amountRaw = cells[2]!.trim();
    const currencyRaw = cells[3]!.trim();
    const occurredAtRaw = cells[4]!.trim();
    const descriptionRaw = cells[5]!;
    const categoryPathRaw = cells[6]!;

    const typeResult = parseTypeCell(typeRaw);
    if (!typeResult.ok) {
      errors.push({
        row: dataRow,
        message: typeResult.message,
      });
      continue;
    }
    const type = typeResult.type;

    let amount: number;
    try {
      amount = parsePositiveAmount(amountRaw).toNumber();
    } catch (error) {
      errors.push({
        row: dataRow,
        message: error instanceof Error ? error.message : "amount must be a positive number",
      });
      continue;
    }

    if (currencyRaw === "" || currencyRaw.toUpperCase() !== expectedCurrency) {
      errors.push({
        row: dataRow,
        message: `currency must match account currency (${expectedCurrency})`,
      });
      continue;
    }

    if (occurredAtRaw === "") {
      errors.push({
        row: dataRow,
        message: "occurredAt is required",
      });
      continue;
    }
    const occurredAt = new Date(occurredAtRaw);
    if (Number.isNaN(occurredAt.getTime())) {
      errors.push({
        row: dataRow,
        message: "occurredAt must be a valid date",
      });
      continue;
    }

    const descriptionTrimmed = unescapeImportedFormula(descriptionRaw.trim());
    const description = descriptionTrimmed.length ? descriptionTrimmed : null;

    const pathResult = parseCategoryPath(categoryPathRaw);
    if (!pathResult.ok) {
      errors.push({
        row: dataRow,
        message: pathResult.message,
      });
      continue;
    }
    const categoryPath =
      pathResult.segments.length === 0 ? null : pathResult.segments;

    drafts.push({
      row: dataRow,
      type,
      amount,
      occurredAt,
      description,
      categoryPath,
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, drafts };
}

export function formatImportErrors(errors: ImportRowError[]): string {
  if (errors.length === 0) return "Invalid CSV";
  if (errors.length === 1) {
    const only = errors[0]!;
    if (only.row === 0) return only.message;
    return `Row ${only.row}: ${only.message}`;
  }
  return errors
    .map((e) => (e.row === 0 ? e.message : `Row ${e.row}: ${e.message}`))
    .join("; ");
}

function parseTypeCell(
  raw: string,
): { ok: true; type: CashTxType } | { ok: false; message: string } {
  const upper = raw.trim().toUpperCase();
  if (upper === "TRANSFER_IN" || upper === "TRANSFER_OUT") {
    return {
      ok: false,
      message: "TRANSFER_* rows cannot be imported; manage transfers via /api/transfers",
    };
  }
  if (upper === "INCOME" || upper === "EXPENSE") {
    return { ok: true, type: upper };
  }
  return {
    ok: false,
    message: `type must be one of: ${CASH_TX_TYPES.join(", ")}`,
  };
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Split CSV text into records of cells (RFC4180-ish). */
function splitCsvRecords(text: string): string[][] {
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
    if (ch === ",") {
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
    // Unterminated quote — still flush what we have; header check will fail or row error.
    row.push(cell);
    records.push(row);
    return records;
  }

  // Trailing content without final newline
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    records.push(row);
  }

  // Drop a single trailing empty record from final newline after last row
  while (
    records.length > 1 &&
    records[records.length - 1]!.length === 1 &&
    records[records.length - 1]![0] === ""
  ) {
    records.pop();
  }

  return records;
}
