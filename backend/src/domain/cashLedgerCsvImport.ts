import { CASH_TX_TYPES, parsePositiveAmount, type CashTxType } from "./cashLedger";
import {
  CASH_LEDGER_CSV_HEADER,
  LEGACY_CASH_LEDGER_CSV_HEADER,
  parseCategoryPath,
} from "./cashLedgerCsv";

const CURRENT_HEADER_COLUMNS = CASH_LEDGER_CSV_HEADER.split(",");
const LEGACY_HEADER_COLUMNS = LEGACY_CASH_LEDGER_CSV_HEADER.split(",");

export type ImportRowError = {
  row: number;
  message: string;
};

export type SkippedTransferRow = {
  row: number;
  type: "TRANSFER_IN" | "TRANSFER_OUT";
  message: string;
};

const SKIPPED_TRANSFER_MESSAGE =
  "Internal transfer — import via Transfers page";

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
  /**
   * Set only for legacy (categoryId/categoryName) CSV rows.
   * Resolved to a path via enrichLegacyCategoryPaths when the id is owned.
   */
  legacyCategoryId?: number | null;
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
  | {
      ok: true;
      drafts: CashLedgerImportDraft[];
      skippedTransfers: SkippedTransferRow[];
    }
  | { ok: false; errors: ImportRowError[] };

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function unescapeImportedFormula(value: string): string {
  if (value.startsWith("'") && FORMULA_PREFIX.test(value.slice(1))) {
    return value.slice(1);
  }
  return value;
}

type CsvFormat = "current" | "legacy";

/**
 * Parse and validate cash-ledger CSV (current or legacy 319e8fa export).
 * Ignores id and createdAt. Category paths are not fully resolved here —
 * legacy rows may carry legacyCategoryId for enrichLegacyCategoryPaths.
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
  let format: CsvFormat;
  let expectedColumns: number;
  if (headerJoined === CASH_LEDGER_CSV_HEADER) {
    format = "current";
    expectedColumns = CURRENT_HEADER_COLUMNS.length;
  } else if (headerJoined === LEGACY_CASH_LEDGER_CSV_HEADER) {
    format = "legacy";
    expectedColumns = LEGACY_HEADER_COLUMNS.length;
  } else {
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
  const skippedTransfers: SkippedTransferRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i]!;
    const dataRow = i; // 1-based data row index
    if (cells.length === 1 && cells[0] === "") {
      continue; // trailing blank line
    }
    if (cells.length !== expectedColumns) {
      errors.push({
        row: dataRow,
        message: `expected ${expectedColumns} columns, got ${cells.length}`,
      });
      continue;
    }

    const typeRaw = cells[1]!.trim();
    const amountRaw = cells[2]!.trim();
    const currencyRaw = cells[3]!.trim();
    const occurredAtRaw = cells[4]!.trim();
    const descriptionRaw = cells[5]!;

    const typeResult = parseTypeCell(typeRaw);
    if (typeResult.kind === "transfer") {
      skippedTransfers.push({
        row: dataRow,
        type: typeResult.type,
        message: SKIPPED_TRANSFER_MESSAGE,
      });
      continue;
    }
    if (typeResult.kind === "error") {
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

    if (format === "current") {
      const pathResult = parseCategoryPath(cells[6]!);
      if (!pathResult.ok) {
        errors.push({
          row: dataRow,
          message: pathResult.message,
        });
        continue;
      }
      drafts.push({
        row: dataRow,
        type,
        amount,
        occurredAt,
        description,
        categoryPath:
          pathResult.segments.length === 0 ? null : pathResult.segments,
      });
      continue;
    }

    // legacy: categoryId, categoryName
    const categoryIdRaw = cells[6]!.trim();
    const categoryNameRaw = cells[7]!;
    let legacyCategoryId: number | null = null;
    if (categoryIdRaw !== "") {
      const id = Number(categoryIdRaw);
      if (!Number.isInteger(id) || id < 1) {
        errors.push({
          row: dataRow,
          message: "categoryId must be a positive integer",
        });
        continue;
      }
      legacyCategoryId = id;
    }

    const nameTrimmed = unescapeImportedFormula(categoryNameRaw.trim());
    const categoryPath = nameTrimmed.length ? [nameTrimmed] : null;

    drafts.push({
      row: dataRow,
      type,
      amount,
      occurredAt,
      description,
      categoryPath,
      legacyCategoryId,
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, drafts, skippedTransfers };
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

type ParseTypeCellResult =
  | { kind: "cash"; type: CashTxType }
  | { kind: "transfer"; type: "TRANSFER_IN" | "TRANSFER_OUT" }
  | { kind: "error"; message: string };

function parseTypeCell(raw: string): ParseTypeCellResult {
  const upper = raw.trim().toUpperCase();
  if (upper === "TRANSFER_IN" || upper === "TRANSFER_OUT") {
    return { kind: "transfer", type: upper };
  }
  if (upper === "INCOME" || upper === "EXPENSE") {
    return { kind: "cash", type: upper };
  }
  return {
    kind: "error",
    message: `type must be one of: ${CASH_TX_TYPES.join(", ")}`,
  };
}

export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Split CSV text into records of cells (RFC4180-ish). */
export function splitCsvRecords(text: string): string[][] {
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
