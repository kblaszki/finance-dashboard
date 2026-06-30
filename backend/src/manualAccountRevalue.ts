import type { Prisma, PrismaClient } from "@prisma/client";
import type { TransactionType } from "./transactionBalance";
import { toNumber } from "./accountValuation";

type DbClient = PrismaClient | Prisma.TransactionClient;

type RevalueDeps = {
  recalcTransactionBalances: (db: DbClient, accountId: number, fromDate?: Date) => Promise<void>;
  recomputeAccountValuationsFrom: (
    db: DbClient,
    accountId: number,
    fromDate: Date,
    plnPerUnit: Record<string, number>,
  ) => Promise<void>;
};

export async function revalueManualAccount(
  prisma: PrismaClient,
  account: { id: number; accountType: string; currency: string; cashBalance: unknown },
  value: number,
  valuationDate: Date,
  plnPerUnit: Record<string, number>,
  deps: RevalueDeps,
) {
  const priorValue = toNumber(account.cashBalance);
  const delta = value - priorValue;

  await prisma.$transaction(async (tx) => {
    if (delta !== 0) {
      const transactionType: TransactionType = delta > 0 ? "INCOME" : "EXPENSE";
      await tx.transaction.create({
        data: {
          accountId: account.id,
          transactionType,
          amount: Math.abs(delta),
          balanceAfter: value,
          currency: account.currency,
          category: "REVALUATION",
          date: valuationDate,
          description: "Manual asset revaluation",
        },
      });
    }

    await tx.account.update({
      where: { id: account.id },
      data: { cashBalance: value },
    });

    await deps.recalcTransactionBalances(tx, account.id, valuationDate);
    await deps.recomputeAccountValuationsFrom(tx, account.id, valuationDate, plnPerUnit);
  });

  return prisma.account.findUniqueOrThrow({ where: { id: account.id } });
}
