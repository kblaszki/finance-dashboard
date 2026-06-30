import type { PrismaClient } from "@prisma/client";
import { CASH_BALANCE_ACCOUNT_TYPES, isRevalueAccountType, type AccountType } from "./accountTypes";
import { convertAmount, getFxRatesPlnPerUnit } from "./fx";
import { getLatestAccountTotalValues, toNumber } from "./accountValuation";
import { getUserPortfolioPositions } from "./portfolio";

export const NET_WORTH_BUCKETS = [
  "cash",
  "stock_market",
  "crypto",
  "precious_metal_other",
  "real_estate",
] as const;

export type NetWorthBucket = (typeof NET_WORTH_BUCKETS)[number];

export type NetWorthBucketRow = {
  bucket: NetWorthBucket;
  value: number;
  pct: number;
};

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

export async function aggregateNetWorthBuckets(
  prisma: PrismaClient,
  userId: number,
  displayCurrency: string,
  plnPerUnit: Record<string, number>,
): Promise<{ total: number; byBucket: NetWorthBucketRow[] }> {
  const buckets: Record<NetWorthBucket, number> = {
    cash: 0,
    stock_market: 0,
    crypto: 0,
    precious_metal_other: 0,
    real_estate: 0,
  };

  const accounts = await prisma.account.findMany({ where: { userId } });
  const latestValues = await getLatestAccountTotalValues(
    prisma,
    accounts.map((account) => account.id),
  );

  const positions = await getUserPortfolioPositions(prisma, userId, plnPerUnit);
  const holdingsValueByAccount = new Map<number, number>();

  for (const position of positions) {
    if (position.marketValue == null) continue;
    const value = convertAmount(
      position.marketValue,
      position.accountCurrency,
      displayCurrency,
      plnPerUnit,
    );
    buckets[position.assetBucket] += value;
    holdingsValueByAccount.set(
      position.accountId,
      (holdingsValueByAccount.get(position.accountId) ?? 0) + value,
    );
  }

  for (const account of accounts) {
    if (CASH_BALANCE_ACCOUNT_TYPES.has(account.accountType as AccountType)) {
      buckets.cash += convertAmount(
        toNumber(account.cashBalance),
        account.currency,
        displayCurrency,
        plnPerUnit,
      );
    } else if (isRevalueAccountType(account.accountType)) {
      const totalNative = latestValues.get(account.id) ?? toNumber(account.cashBalance);
      const totalDisplay = convertAmount(totalNative, account.currency, displayCurrency, plnPerUnit);
      const heldDisplay = holdingsValueByAccount.get(account.id) ?? 0;
      buckets.real_estate += Math.max(0, totalDisplay - heldDisplay);
    }
  }

  const total = NET_WORTH_BUCKETS.reduce((sum, bucket) => sum + buckets[bucket], 0);
  const byBucket: NetWorthBucketRow[] = NET_WORTH_BUCKETS.map((bucket) => ({
    bucket,
    value: buckets[bucket],
    pct: total > 0 ? (buckets[bucket] / total) * 100 : 0,
  }));

  return { total, byBucket };
}

export async function computeNetWorth(
  prisma: PrismaClient,
  userId: number,
  displayCurrency: string,
): Promise<{
  total: number;
  currency: string;
  byAccountType: Record<string, number>;
  byBucket: NetWorthBucketRow[];
  accounts: Array<{ id: number; name: string; accountType: string; value: number }>;
}> {
  const { plnPerUnit } = await getFxRatesPlnPerUnit();
  const accounts = await prisma.account.findMany({ where: { userId } });
  const latestValues = await getLatestAccountTotalValues(
    prisma,
    accounts.map((account) => account.id),
  );
  const inputs: NetWorthAccountInput[] = accounts.map((account) => ({
    id: account.id,
    name: account.name,
    accountType: account.accountType,
    currency: account.currency,
    cashBalance: account.cashBalance,
    valueNative: latestValues.get(account.id) ?? toNumber(account.cashBalance),
  }));

  const legacy = sumAccountsInDisplayCurrency(inputs, displayCurrency, plnPerUnit);
  const bucketSummary = await aggregateNetWorthBuckets(prisma, userId, displayCurrency, plnPerUnit);

  return {
    total: bucketSummary.total,
    currency: displayCurrency,
    byAccountType: legacy.byAccountType,
    byBucket: bucketSummary.byBucket,
    accounts: legacy.accounts,
  };
}
