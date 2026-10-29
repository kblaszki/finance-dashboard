import { Prisma } from "@prisma/client";
import { badRequest } from "../lib/errors";
import {
  assertFxCurrency,
  convertMajor,
  formatYmdUtc,
  type FxCurrency,
  type FxNbpCurrency,
  type GetMidFn,
  isFxCurrency,
} from "./fx";
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

export type NetWorthRateUsed = {
  currency: FxNbpCurrency;
  rateDate: string;
  mid: number;
};

export type NetWorthResult = {
  currency: FxCurrency;
  asOf: string;
  byBucket: NetWorthByBucket;
  liabilities: number;
  netWorth: number;
  ratesUsed: NetWorthRateUsed[];
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

function roundMajor(value: Prisma.Decimal): number {
  return value.toDecimalPlaces(2).toNumber();
}

function assertSupportedAccountCurrency(code: string): FxCurrency {
  if (!isFxCurrency(code)) {
    throw badRequest(
      `Unsupported account currency ${code}; net worth supports only PLN, EUR, and USD`,
    );
  }
  return code;
}

export type GetMidRowFn = (
  currency: FxNbpCurrency,
  asOf: Date,
) => Promise<{ mid: Prisma.Decimal; rateDate: Date }>;

/**
 * Convert all owned account balances into the reporting currency via NBP mids.
 * Missing required rates must fail through `getMid` / `getMidRow`.
 */
export async function aggregateNetWorth(input: {
  currency: string;
  asOf: Date;
  accounts: NetWorthAccountRow[];
  getMid: GetMidFn;
  getMidRow?: GetMidRowFn;
}): Promise<NetWorthResult> {
  const reporting = assertFxCurrency(input.currency);
  const asOfYmd = formatYmdUtc(input.asOf);
  const byBucketDec: Record<NetWorthBucket, Prisma.Decimal> = {
    cash: new Prisma.Decimal(0),
    stock: new Prisma.Decimal(0),
    crypto: new Prisma.Decimal(0),
    metal: new Prisma.Decimal(0),
    real_estate: new Prisma.Decimal(0),
    other: new Prisma.Decimal(0),
  };
  let liabilities = new Prisma.Decimal(0);
  const ratesUsed = new Map<FxNbpCurrency, NetWorthRateUsed>();

  const midCache = new Map<FxNbpCurrency, Prisma.Decimal>();
  const getMidCached: GetMidFn = async (currency, asOf) => {
    const cached = midCache.get(currency);
    if (cached) return cached;
    if (input.getMidRow) {
      const row = await input.getMidRow(currency, asOf);
      midCache.set(currency, row.mid);
      ratesUsed.set(currency, {
        currency,
        rateDate: formatYmdUtc(row.rateDate),
        mid: row.mid.toNumber(),
      });
      return row.mid;
    }
    const mid = await input.getMid(currency, asOf);
    midCache.set(currency, mid);
    return mid;
  };

  for (const account of input.accounts) {
    const accountCurrency = assertSupportedAccountCurrency(
      String(account.currency).trim().toUpperCase(),
    );
    const amount = majorToDecimal(account.cashBalance);
    if (!amount || amount.isZero()) continue;

    const converted = new Prisma.Decimal(
      (
        await convertMajor({
          amount: amount.toNumber(),
          from: accountCurrency,
          to: reporting,
          asOf: input.asOf,
          getMid: getMidCached,
        })
      ).toString(),
    );

    if (isCreditCard(account.accountType)) {
      if (converted.isNegative()) {
        liabilities = liabilities.add(converted.negated());
      } else if (converted.isPositive()) {
        byBucketDec.cash = byBucketDec.cash.add(converted);
      }
      continue;
    }

    const bucket = accountTypeToBucket(account.accountType);
    byBucketDec[bucket] = byBucketDec[bucket].add(converted);
  }

  const byBucket = emptyBuckets();
  for (const key of NET_WORTH_BUCKETS) {
    byBucket[key] = roundMajor(byBucketDec[key]);
  }
  const liabilitiesMajor = roundMajor(liabilities);
  const bucketSum = NET_WORTH_BUCKETS.reduce(
    (sum, key) => sum + byBucket[key],
    0,
  );

  return {
    currency: reporting,
    asOf: asOfYmd,
    byBucket,
    liabilities: liabilitiesMajor,
    netWorth: new Prisma.Decimal(bucketSum - liabilitiesMajor)
      .toDecimalPlaces(2)
      .toNumber(),
    ratesUsed: [...ratesUsed.values()].sort((a, b) =>
      a.currency.localeCompare(b.currency),
    ),
  };
}

/** UTC midnight of the last calendar day of YYYY-MM, or today when month is current. */
export function valuationDateForMonth(
  month: string,
  asOfToday: Date = new Date(),
): Date {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month.trim());
  if (!m) throw badRequest("month must be YYYY-MM");
  const year = Number(m[1]);
  const monthIndex = Number(m[2]) - 1;
  const currentYear = asOfToday.getUTCFullYear();
  const currentMonth = asOfToday.getUTCMonth();
  if (
    year > currentYear ||
    (year === currentYear && monthIndex > currentMonth)
  ) {
    throw badRequest("month cannot be in the future");
  }
  if (year === currentYear && monthIndex === currentMonth) {
    return new Date(
      Date.UTC(
        asOfToday.getUTCFullYear(),
        asOfToday.getUTCMonth(),
        asOfToday.getUTCDate(),
      ),
    );
  }
  // Day 0 of next month = last day of this month
  return new Date(Date.UTC(year, monthIndex + 1, 0));
}

export function parseReportingCurrencyParam(value: unknown): FxCurrency {
  return assertFxCurrency(value);
}

export { isFxCurrency };
