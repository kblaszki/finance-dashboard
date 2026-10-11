import { Prisma } from "@prisma/client";
import { majorToDecimal } from "./money";

export const NET_WORTH_BUCKETS = [
  "cash",
  "stock",
  "crypto",
  "metal",
  "real_estate",
  "other",
] as const;

export type NetWorthBucket = (typeof NET_WORTH_BUCKETS)[number];

export type NetWorthByBucket = Record<NetWorthBucket, number>;

export type NetWorthAccountRow = {
  accountType: string;
  currency: string;
  cashBalance: Prisma.Decimal | number;
};

export type NetWorthResult = {
  currency: string;
  byBucket: NetWorthByBucket;
  liabilities: number;
  netWorth: number;
};

const TYPE_TO_BUCKET: Record<string, NetWorthBucket> = {
  BANK: "cash",
  BROKERAGE: "stock",
  CRYPTO: "crypto",
  PRECIOUS_METAL: "metal",
  REAL_ESTATE: "real_estate",
  IKE: "stock",
  IKZE: "stock",
  TREASURY_BONDS: "other",
  OTHER: "other",
  MANUAL: "other",
};

export function accountTypeToBucket(accountType: string): NetWorthBucket {
  const key = String(accountType).trim().toUpperCase();
  return TYPE_TO_BUCKET[key] ?? "other";
}

function emptyBuckets(): NetWorthByBucket {
  return {
    cash: 0,
    stock: 0,
    crypto: 0,
    metal: 0,
    real_estate: 0,
    other: 0,
  };
}

function isCreditCard(accountType: string): boolean {
  return String(accountType).trim().toUpperCase() === "CREDIT_CARD";
}

export function aggregateNetWorth(
  currency: string,
  accounts: NetWorthAccountRow[],
): NetWorthResult {
  const byBucket = emptyBuckets();
  let liabilities = new Prisma.Decimal(0);

  for (const account of accounts) {
    if (account.currency !== currency) continue;
    const amount = majorToDecimal(account.cashBalance);
    if (!amount) continue;

    if (isCreditCard(account.accountType)) {
      if (amount.isNegative()) {
        liabilities = liabilities.add(amount.negated());
      } else if (amount.isPositive()) {
        byBucket.cash = new Prisma.Decimal(byBucket.cash).add(amount).toNumber();
      }
      continue;
    }

    const bucket = accountTypeToBucket(account.accountType);
    byBucket[bucket] = new Prisma.Decimal(byBucket[bucket]).add(amount).toNumber();
  }

  const liabilitiesMajor = liabilities.toNumber();
  const bucketSum = NET_WORTH_BUCKETS.reduce(
    (sum, key) => sum + byBucket[key],
    0,
  );

  return {
    currency,
    byBucket,
    liabilities: liabilitiesMajor,
    netWorth: bucketSum - liabilitiesMajor,
  };
}
