export const CASH_LEDGER_CSV_HEADER =
  "id,type,amount,currency,occurredAt,description,categoryId,categoryName,createdAt" as const;

export type CashLedgerCsvRow = {
  id: number;
  type: string;
  amount: number;
  occurredAt: Date | string;
  description: string | null;
  categoryId: number | null;
  categoryName: string | null;
  createdAt: Date | string;
};

/** RFC4180 field escape + Excel formula-injection neutralization. */
export function escapeCsvCell(value: string): string {
  let text = value;
  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function formatAmount(amount: number): string {
  const n = Number.isFinite(amount) ? amount : 0;
  return n.toFixed(2);
}

function formatIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toISOString();
}

/**
 * Build a UTF-8 CSV (no BOM) for one account's cash ledger.
 * Caller supplies rows already ordered (oldest → newest).
 */
export function buildCashLedgerCsv(input: {
  currency: string;
  rows: CashLedgerCsvRow[];
}): string {
  const currency = String(input.currency || "").toUpperCase();
  const lines = [CASH_LEDGER_CSV_HEADER];

  for (const row of input.rows) {
    const cells = [
      String(row.id),
      escapeCsvCell(String(row.type)),
      formatAmount(Number(row.amount)),
      escapeCsvCell(currency),
      escapeCsvCell(formatIso(row.occurredAt)),
      escapeCsvCell(row.description ?? ""),
      row.categoryId == null ? "" : String(row.categoryId),
      escapeCsvCell(row.categoryName ?? ""),
      escapeCsvCell(formatIso(row.createdAt)),
    ];
    lines.push(cells.join(","));
  }

  return `${lines.join("\n")}\n`;
}

export function cashLedgerExportFilename(accountId: number): string {
  return `account-${accountId}-cash.csv`;
}
