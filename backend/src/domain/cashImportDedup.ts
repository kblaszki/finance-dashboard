import type { Prisma, PrismaClient } from "@prisma/client";
import type { CashLedgerImportDraft } from "./cashLedgerCsvImport";
import { CASH_TX_TYPES, type CashTxType } from "./cashLedger";
import { majorToMinor } from "./money";

type Db = PrismaClient | Prisma.TransactionClient;

export type SkippedDuplicateRow = {
  /** 1-based CSV data row index. */
  row: number;
  type: CashTxType;
  /** Major units (same as draft/API). */
  amount: number;
  /** UTC calendar day YYYY-MM-DD. */
  occurredAt: string;
  description: string | null;
  message: string;
};

const DUPLICATE_MESSAGE =
  "Already on this account (same date, type, amount, description)";

export function normalizeImportDescription(desc: string | null): string {
  if (desc == null) return "";
  return String(desc).trim().replace(/\s+/g, " ").toLowerCase();
}

export function utcDayKey(occurredAt: Date): string {
  return occurredAt.toISOString().slice(0, 10);
}

export function cashImportFingerprint(input: {
  type: string;
  amountMinor: number;
  occurredAt: Date;
  description: string | null;
}): string {
  const type = String(input.type).trim().toUpperCase();
  const day = utcDayKey(input.occurredAt);
  const desc = normalizeImportDescription(input.description);
  return `${type}\0${input.amountMinor}\0${day}\0${desc}`;
}

export function fingerprintFromDraft(draft: CashLedgerImportDraft): string {
  const amountMinor = majorToMinor(draft.amount, "amount");
  return cashImportFingerprint({
    type: draft.type,
    amountMinor,
    occurredAt: draft.occurredAt,
    description: draft.description,
  });
}

export function partitionDraftsByExisting(
  drafts: CashLedgerImportDraft[],
  existingFingerprints: Set<string>,
): {
  toImport: CashLedgerImportDraft[];
  skippedDuplicates: SkippedDuplicateRow[];
} {
  const seen = new Set(existingFingerprints);
  const toImport: CashLedgerImportDraft[] = [];
  const skippedDuplicates: SkippedDuplicateRow[] = [];

  for (const draft of drafts) {
    const key = fingerprintFromDraft(draft);
    if (seen.has(key)) {
      skippedDuplicates.push({
        row: draft.row,
        type: draft.type,
        amount: draft.amount,
        occurredAt: utcDayKey(draft.occurredAt),
        description: draft.description,
        message: DUPLICATE_MESSAGE,
      });
      continue;
    }
    seen.add(key);
    toImport.push(draft);
  }

  return { toImport, skippedDuplicates };
}

export async function loadAccountImportFingerprints(
  db: Db,
  accountId: number,
): Promise<Set<string>> {
  const rows = await db.cashTransaction.findMany({
    where: {
      accountId,
      type: { in: [...CASH_TX_TYPES] },
    },
    select: {
      type: true,
      amount: true,
      occurredAt: true,
      description: true,
    },
  });
  const set = new Set<string>();
  for (const row of rows) {
    set.add(
      cashImportFingerprint({
        type: row.type,
        amountMinor: row.amount,
        occurredAt: row.occurredAt,
        description: row.description,
      }),
    );
  }
  return set;
}

export type ImportBatchSource = "ledger_csv" | "columns_csv";

export async function createImportBatch(
  db: Db,
  input: {
    userId: number;
    accountId: number;
    source: ImportBatchSource;
    createdCount: number;
    skippedDuplicateCount: number;
    skippedTransferCount: number;
  },
): Promise<void> {
  await db.importBatch.create({
    data: {
      userId: input.userId,
      accountId: input.accountId,
      source: input.source,
      createdCount: input.createdCount,
      skippedDuplicateCount: input.skippedDuplicateCount,
      skippedTransferCount: input.skippedTransferCount,
    },
  });
}
