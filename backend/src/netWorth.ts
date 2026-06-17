import type { PrismaClient } from "@prisma/client";
import { convertAmount, getFxRatesPlnPerUnit } from "./fx";
import { getLatestAccountTotalValue, toNumber } from "./accountValuation";

export type NetWorthAccountInput = {
  id: number;
  name: string;
  accountType: string;
  currency: string;
  cashBalance: unknown;
  valueNative: number;
};

export function sumAccountsInDisplayCurrency(
  accounts: NetWorthAccountInput[],
  displayCurrency: string,
  plnPerUnit: Record<string, number>,
): {
  total: number;
  currency: string;
  byAccountType: Record<string, number>;
  accounts: Array<{ id: number; name: string; accountType: string; value: number }>;
} {
  const byAccountType: Record<string, number> = {};
  const accountRows: Array<{ id: number; name: string; accountType: string; value: number }> = [];
  let total = 0;

  for (const account of accounts) {
    const valueDisplay = convertAmount(
      account.valueNative,
      account.currency,
      displayCurrency,
      plnPerUnit,
    );
    byAccountType[account.accountType] = (byAccountType[account.accountType] ?? 0) + valueDisplay;
    accountRows.push({
      id: account.id,
      name: account.name,
      accountType: account.accountType,
      value: valueDisplay,
    });
    total += valueDisplay;
  }

  return {
    total,
    currency: displayCurrency,
    byAccountType,
    accounts: accountRows,
  };
}

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
  const inputs: NetWorthAccountInput[] = [];

  for (const account of accounts) {
    const latest = await getLatestAccountTotalValue(prisma, account.id);
    inputs.push({
      id: account.id,
      name: account.name,
      accountType: account.accountType,
      currency: account.currency,
      cashBalance: account.cashBalance,
      valueNative: latest ?? toNumber(account.cashBalance),
    });
  }

  return sumAccountsInDisplayCurrency(inputs, displayCurrency, plnPerUnit);
}
