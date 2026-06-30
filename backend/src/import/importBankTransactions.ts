import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { recalcTransactionBalances } from "../accountValuation";
import { parseBankCsv } from "./bankParser";
import type { BankId, BankImportPreviewRow, BankImportResult, ParsedBankRow } from "./bankTypes";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type ImportBankInput = {
  accountId: number;
  userId: number;
  bank: BankId;
  csvText: string;
  filename?: string;
  dryRun: boolean;
};

function bankExternalHash(accountId: number, bank: BankId, row: ParsedBankRow): string {
  const parts = [
    String(accountId),
    bank,
    row.externalId ?? row.date.toISOString().slice(0, 10),
    String(row.amount),
    row.description,
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

function toPreviewRow(row: ParsedBankRow): BankImportPreviewRow {
  return {
    row: row.row,
    date: row.date.toISOString(),
    description: row.description,
    amount: row.amount,
    transactionType: row.transactionType,
    currency: row.currency,
  };
}

export async function importBankTransactions(
  prisma: PrismaClient,
  input: ImportBankInput,
): Promise<BankImportResult> {
  const account = await prisma.account.findFirst({
    where: { id: input.accountId, userId: input.userId },
  });
  if (!account) {
    throw new Error("Account not found");
  }
  if (account.accountType !== "BANK") {
    throw new Error("Bank import is only supported for bank accounts");
  }

  const { rows: parsedRows, errors } = parseBankCsv(input.bank, input.csvText, account.currency);
  const preview = parsedRows.map(toPreviewRow);
  const brokerKey = `bank:${input.bank}`;

  if (input.dryRun) {
    return {
      dryRun: true,
      parsed: parsedRows.length,
      imported: 0,
      skipped: 0,
      errors,
      preview,
    };
  }

  let imported = 0;
  let skipped = 0;
  let earliestDate: Date | null = null;

  await prisma.$transaction(async (tx) => {
    const batch = await tx.importBatch.create({
      data: {
        accountId: input.accountId,
        broker: brokerKey,
        filename: input.filename ?? null,
      },
    });

    for (const row of parsedRows) {
      const hash = bankExternalHash(input.accountId, input.bank, row);
      const existing = await tx.importRow.findUnique({
        where: { accountId_externalHash: { accountId: input.accountId, externalHash: hash } },
      });
      if (existing) {
        skipped++;
        continue;
      }

      try {
        const created = await tx.transaction.create({
          data: {
            accountId: input.accountId,
            transactionType: row.transactionType,
            amount: row.amount,
            balanceAfter: 0,
            currency: row.currency,
            category: "Uncategorized",
            date: row.date,
            description: row.description,
          },
        });
        await tx.importRow.create({
          data: {
            batchId: batch.id,
            accountId: input.accountId,
            externalHash: hash,
            transactionId: created.id,
          },
        });
        if (!earliestDate || row.date < earliestDate) earliestDate = row.date;
        imported++;
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Import failed";
        errors.push({ row: row.row, message });
      }
    }

    if (earliestDate) {
      await recalcTransactionBalances(tx, input.accountId, earliestDate);
    }
  });

  return {
    dryRun: false,
    parsed: parsedRows.length,
    imported,
    skipped,
    errors,
    preview,
  };
}
