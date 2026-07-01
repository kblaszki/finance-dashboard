import type { PrismaClient } from "@prisma/client";

export async function exportUserData(prisma: PrismaClient, userId: number) {
  const [
    user,
    accounts,
    transactions,
    categories,
    budgets,
    holdings,
    holdingLots,
    instruments,
    incomeEvents,
    liabilities,
    propertyCashFlows,
    internalTransfers,
    importBatches,
    taxReportSnapshots,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, username: true, createdAt: true },
    }),
    prisma.account.findMany({ where: { userId } }),
    prisma.transaction.findMany({
      where: { account: { userId } },
      include: { splits: true },
    }),
    prisma.category.findMany({ where: { userId } }),
    prisma.budget.findMany({ where: { userId } }),
    prisma.holding.findMany({ where: { account: { userId } } }),
    prisma.holdingLot.findMany({ where: { holding: { account: { userId } } } }),
    prisma.instrument.findMany({
      where: { holdings: { some: { account: { userId } } } },
    }),
    prisma.incomeEvent.findMany({ where: { userId } }),
    prisma.liability.findMany({ where: { userId } }),
    prisma.propertyCashFlow.findMany({ where: { userId } }),
    prisma.positionTransfer.findMany({ where: { userId } }),
    prisma.importBatch.findMany({ where: { account: { userId } } }),
    prisma.taxReportSnapshot.findMany({ where: { userId } }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    formatVersion: 1,
    user,
    accounts,
    transactions,
    categories,
    budgets,
    holdings,
    holdingLots,
    instruments,
    incomeEvents,
    liabilities,
    propertyCashFlows,
    positionTransfers: internalTransfers,
    importBatches,
    taxReportSnapshots,
  };
}
