import type { PrismaClient } from "@prisma/client";

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  if (v && typeof v === "object") {
    const anyV = v as { toNumber?: () => number; toString?: () => string };
    if (typeof anyV.toNumber === "function") return anyV.toNumber();
    if (typeof anyV.toString === "function") return Number(anyV.toString());
  }
  return Number(v);
}

export async function computeBankBalance(
  prisma: PrismaClient,
  userId: number,
  accountId: number,
): Promise<number> {
  const account = await prisma.financialAccount.findFirst({
    where: { id: accountId, userId, type: "BANK" },
  });
  if (!account) return 0;

  const txs = await prisma.transaction.findMany({
    where: {
      userId,
      accountId,
      type: { in: ["INCOME", "EXPENSE"] },
    },
  });

  let balance = toNumber(account.openingBalance);
  for (const t of txs) {
    const amount = toNumber(t.amount);
    if (t.type === "INCOME") balance += amount;
    if (t.type === "EXPENSE") balance -= amount;
  }
  return balance;
}

export async function computeBankBalancesForUser(
  prisma: PrismaClient,
  userId: number,
): Promise<Map<number, number>> {
  const accounts = await prisma.financialAccount.findMany({
    where: { userId, type: "BANK" },
  });
  const map = new Map<number, number>();
  for (const acc of accounts) {
    map.set(acc.id, await computeBankBalance(prisma, userId, acc.id));
  }
  return map;
}

export async function syncBondAccountManualValue(
  prisma: PrismaClient,
  userId: number,
  accountId: number,
): Promise<void> {
  const account = await prisma.financialAccount.findFirst({
    where: { id: accountId, userId, type: "BONDS" },
  });
  if (!account) return;

  const holdings = await prisma.bondHolding.findMany({ where: { accountId } });
  const total = holdings.reduce((acc, h) => acc + toNumber(h.nominal), 0);
  await prisma.financialAccount.update({
    where: { id: accountId },
    data: { manualValue: total },
  });
}
