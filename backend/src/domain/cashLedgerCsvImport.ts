import { CASH_TX_TYPES, parsePositiveAmount, type CashTxType } from "./cashLedger";
import { CASH_LEDGER_CSV_HEADER } from "./cashLedgerCsv";

const HEADER_COLUMNS = CASH_LEDGER_CSV_HEADER.split(",");

export type ImportRowError = {
  row: number;
  message: string;
};

/** One validated CSV data row before category ownership/name resolution. */
export type CashLedgerImportDraft = {
  /** 1-based data row index (header excluded). */
  row: number;
  type: CashTxType;
  amount: number;
  occurredAt: Date;
  description: string | null;
  categoryId: number | null;
  categoryName: string | null;
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

export type ResolveImportResult =
  | { ok: true; rows: CashLedgerImportResolved[] }
  | { ok: false; errors: ImportRowError[] };

/**
 * Parse and validate cash-ledger CSV (export format). Ignores id and createdAt.
 * Does not check category ownership — use resolveImportCategoryIds.
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

  const headerCells = lines[0]!;
  if (headerCells.join(",") !== CASH_LEDGER_CSV_HEADER) {
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
    const categoryIdRaw = cells[6]!.trim();
    const categoryNameRaw = cells[7]!;

    const type = parseTypeCell(typeRaw);
    if (type == null) {
      errors.push({
        row: dataRow,
        message: `type must be one of: ${CASH_TX_TYPES.join(", ")}`,
      });
      continue;
    }

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

    if (currencyRaw !== "") {
      if (currencyRaw.toUpperCase() !== expectedCurrency) {
        errors.push({
          row: dataRow,
          message: `currency must match account currency (${expectedCurrency})`,
        });
        continue;
      }
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

    const descriptionTrimmed = descriptionRaw.trim();
    const description = descriptionTrimmed.length ? descriptionTrimmed : null;

    let categoryId: number | null = null;
    let categoryName: string | null = null;
    if (categoryIdRaw !== "") {
      const n = Number(categoryIdRaw);
      if (!Number.isInteger(n) || n < 1) {
        errors.push({
          row: dataRow,
          message: "categoryId must be a valid id",
        });
        continue;
      }
      categoryId = n;
    } else if (categoryNameRaw.trim() !== "") {
      categoryName = categoryNameRaw.trim();
    }

    drafts.push({
      row: dataRow,
      type,
      amount,
      occurredAt,
      description,
      categoryId,
      categoryName,
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, drafts };
}

/** Resolve categoryId ownership and unique categoryName matches. */
export function resolveImportCategoryIds(
  drafts: CashLedgerImportDraft[],
  ownedCategories: Array<{ id: number; name: string }>,
): ResolveImportResult {
  const byId = new Set(ownedCategories.map((c) => c.id));
  const byName = new Map<string, number[]>();
  for (const cat of ownedCategories) {
    const list = byName.get(cat.name) ?? [];
    list.push(cat.id);
    byName.set(cat.name, list);
  }

  const errors: ImportRowError[] = [];
  const rows: CashLedgerImportResolved[] = [];

  for (const draft of drafts) {
    let categoryId: number | null = null;

    if (draft.categoryId != null) {
      if (!byId.has(draft.categoryId)) {
        errors.push({
          row: draft.row,
          message: "categoryId not found",
        });
        continue;
      }
      categoryId = draft.categoryId;
    } else if (draft.categoryName != null) {
      const matches = byName.get(draft.categoryName) ?? [];
      if (matches.length === 0) {
        errors.push({
          row: draft.row,
          message: `categoryName "${draft.categoryName}" not found`,
        });
        continue;
      }
      if (matches.length > 1) {
        errors.push({
          row: draft.row,
          message: `categoryName "${draft.categoryName}" is ambiguous; use categoryId`,
        });
        continue;
      }
      categoryId = matches[0]!;
    }

    rows.push({
      row: draft.row,
      type: draft.type,
      amount: draft.amount,
      occurredAt: draft.occurredAt,
      description: draft.description,
      categoryId,
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, rows };
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

function parseTypeCell(raw: string): CashTxType | null {
  const upper = raw.toUpperCase();
  if (upper === "INCOME" || upper === "EXPENSE") return upper;
  return null;
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
  // (already handled: "\n" pushes a row; empty final "\n\n" would push empty — skip empty all-blank at end)
  while (
    records.length > 1 &&
    records[records.length - 1]!.length === 1 &&
    records[records.length - 1]![0] === ""
  ) {
    records.pop();
  }

  return records;
}
