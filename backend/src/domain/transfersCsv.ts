import { Prisma } from "@prisma/client";
import {
  escapeCsvCell,
} from "./cashLedgerCsv";
import {
  formatImportErrors,
  splitCsvRecords,
  stripBom,
  type ImportRowError,
} from "./cashLedgerCsvImport";
import { parseMoneyDecimal } from "./money";

export const TRANSFERS_CSV_HEADER =
  "id,occurredAt,fromAccount,fromCurrency,toAccount,toCurrency,amountFrom,amountTo,description,createdAt" as const;

const HEADER_COLUMNS = TRANSFERS_CSV_HEADER.split(",");
const CURRENCY_RE = /^[A-Z]{3}$/;
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export type TransfersCsvRow = {
  id: number;
  occurredAt: Date | string;
  fromAccount: string;
  fromCurrency: string;
  toAccount: string;
  toCurrency: string;
  amountFrom: number;
  amountTo: number;
  description: string | null;
  createdAt: Date | string;
};

export type TransferCsvDraft = {
  /** 1-based data row index (header excluded). */
  row: number;
  occurredAt: Date;
  fromName: string;
  fromCurrency: string;
  toName: string;
  toCurrency: string;
  amountFrom: Prisma.Decimal;
  amountTo: Prisma.Decimal;
  description: string | null;
};

export type ParseTransfersResult =
  | { ok: true; drafts: TransferCsvDraft[] }
  | { ok: false; errors: ImportRowError[] };

function formatAmount(amount: number): string {
  if (!Number.isFinite(amount)) return "0.00";
  return new Prisma.Decimal(amount.toString()).toDecimalPlaces(2).toFixed(2);
}

function formatIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toISOString();
}

function unescapeImportedFormula(value: string): string {
  if (value.startsWith("'") && FORMULA_PREFIX.test(value.slice(1))) {
    return value.slice(1);
  }
  return value;
}

/**
 * Build a UTF-8 CSV (no BOM) for internal cash transfers.
 * Caller supplies rows already ordered (oldest → newest).
 */
export function buildTransfersCsv(rows: TransfersCsvRow[]): string {
  const lines: string[] = [TRANSFERS_CSV_HEADER];
  for (const row of rows) {
    const cells = [
      String(row.id),
      escapeCsvCell(formatIso(row.occurredAt)),
      escapeCsvCell(row.fromAccount),
      escapeCsvCell(String(row.fromCurrency || "").toUpperCase()),
      escapeCsvCell(row.toAccount),
      escapeCsvCell(String(row.toCurrency || "").toUpperCase()),
      formatAmount(Number(row.amountFrom)),
      formatAmount(Number(row.amountTo)),
      escapeCsvCell(row.description ?? ""),
      escapeCsvCell(formatIso(row.createdAt)),
    ];
    lines.push(cells.join(","));
  }
  return `${lines.join("\n")}\n`;
}

export function transfersExportFilename(): string {
  return "transfers.csv";
}

/**
 * Parse transfers CSV. Ignores id and createdAt.
 */
export function parseTransfersCsv(csv: string): ParseTransfersResult {
  const text = stripBom(String(csv ?? "")).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = splitCsvRecords(text);
  if (lines.length === 0) {
    return { ok: false, errors: [{ row: 0, message: "CSV header required" }] };
  }

  const headerJoined = lines[0]!.join(",");
  if (headerJoined !== TRANSFERS_CSV_HEADER) {
    return {
      ok: false,
      errors: [
        {
          row: 0,
          message: `CSV header must be: ${TRANSFERS_CSV_HEADER}`,
        },
      ],
    };
  }

  const errors: ImportRowError[] = [];
  const drafts: TransferCsvDraft[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i]!;
    const dataRow = i;
    if (cells.length === 1 && cells[0] === "") continue;
    if (cells.length !== HEADER_COLUMNS.length) {
      errors.push({
        row: dataRow,
        message: `expected ${HEADER_COLUMNS.length} columns, got ${cells.length}`,
      });
      continue;
    }

    const occurredAtRaw = cells[1]!.trim();
    const fromName = cells[2]!.trim();
    const fromCurrency = cells[3]!.trim().toUpperCase();
    const toName = cells[4]!.trim();
    const toCurrency = cells[5]!.trim().toUpperCase();
    const amountFromRaw = cells[6]!.trim();
    const amountToRaw = cells[7]!.trim();
    const descriptionRaw = cells[8]!;

    if (!occurredAtRaw) {
      errors.push({ row: dataRow, message: "occurredAt is required" });
      continue;
    }
    const occurredAt = new Date(occurredAtRaw);
    if (Number.isNaN(occurredAt.getTime())) {
      errors.push({ row: dataRow, message: "occurredAt must be a valid date" });
      continue;
    }

    if (!fromName) {
      errors.push({ row: dataRow, message: "fromAccount is required" });
      continue;
    }
    if (!toName) {
      errors.push({ row: dataRow, message: "toAccount is required" });
      continue;
    }
    if (!CURRENCY_RE.test(fromCurrency)) {
      errors.push({
        row: dataRow,
        message: "fromCurrency must be a 3-letter code",
      });
      continue;
    }
    if (!CURRENCY_RE.test(toCurrency)) {
      errors.push({
        row: dataRow,
        message: "toCurrency must be a 3-letter code",
      });
      continue;
    }

    let amountFrom: Prisma.Decimal;
    try {
      amountFrom = parseMoneyDecimal(amountFromRaw, "amountFrom");
    } catch (error) {
      errors.push({
        row: dataRow,
        message:
          error instanceof Error ? error.message : "amountFrom must be a positive number",
      });
      continue;
    }

    let amountTo: Prisma.Decimal;
    if (fromCurrency === toCurrency) {
      if (amountToRaw === "") {
        amountTo = amountFrom;
      } else {
        try {
          amountTo = parseMoneyDecimal(amountToRaw, "amountTo");
        } catch (error) {
          errors.push({
            row: dataRow,
            message:
              error instanceof Error
                ? error.message
                : "amountTo must be a positive number",
          });
          continue;
        }
        if (!amountTo.equals(amountFrom)) {
          errors.push({
            row: dataRow,
            message: "amountTo must equal amountFrom when currencies match",
          });
          continue;
        }
      }
    } else if (amountToRaw === "") {
      errors.push({
        row: dataRow,
        message: "amountTo required when currencies differ",
      });
      continue;
    } else {
      try {
        amountTo = parseMoneyDecimal(amountToRaw, "amountTo");
      } catch (error) {
        errors.push({
          row: dataRow,
          message:
            error instanceof Error
              ? error.message
              : "amountTo must be a positive number",
        });
        continue;
      }
    }

    const descriptionTrimmed = unescapeImportedFormula(descriptionRaw.trim());
    const description = descriptionTrimmed.length ? descriptionTrimmed : null;

    drafts.push({
      row: dataRow,
      occurredAt,
      fromName,
      fromCurrency,
      toName,
      toCurrency,
      amountFrom,
      amountTo,
      description,
    });
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, drafts };
}

export { formatImportErrors };
export type { ImportRowError };
