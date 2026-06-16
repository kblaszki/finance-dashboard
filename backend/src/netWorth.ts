import type { PrismaClient } from "@prisma/client";
import { getFxRatesPlnPerUnit } from "./fx";
import { getLatestAccountTotalValue, toNumber } from "./accountValuation";

export async function computeNetWorth(
  prisma: PrismaClient,
  userId: number,
  displayCurrency: string,
): Promise<{
  total: number;
  currency: string;
  byAccountType: Record<string, number>;
  accounts: Array<{ id: number; name: string; accountType: string; value: number }>;
}> {
  const { plnPerUnit } = await getFxRatesPlnPerUnit();
  const accounts = await prisma.account.findMany({ where: { userId } });
  const byAccountType: Record<string, number> = {};
  const accountRows: Array<{ id: number; name: string; accountType: string; value: number }> = [];
  let totalPln = 0;

  for (const account of accounts) {
    const latest = await getLatestAccountTotalValue(prisma, account.id);
    const value = latest ?? toNumber(account.cashBalance);
    const valuePln = displayCurrency === "PLN"
      ? value
      : value; // simplified: assume account currency matches for MVP snapshot currency
    void plnPerUnit;
    byAccountType[account.accountType] = (byAccountType[account.accountType] ?? 0) + value;
    accountRows.push({
      id: account.id,
      name: account.name,
      accountType: account.accountType,
      value,
    });
    totalPln += value;
  }

  return {
    total: totalPln,
    currency: displayCurrency,
    byAccountType,
    accounts: accountRows,
  };
}
