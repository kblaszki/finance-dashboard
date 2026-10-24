import { Prisma, type PrismaClient } from "@prisma/client";
import { notFound } from "../lib/errors";
import {
  assertFxNbpCurrency,
  formatYmdUtc,
  type FxNbpCurrency,
  utcDateFromYmd,
} from "./fx";
import { fetchNbpRates, type NbpFetch, type NbpRateRow } from "./nbpClient";

type Db = PrismaClient | Prisma.TransactionClient;

export type UpsertFxRateInput = {
  currency: FxNbpCurrency;
  rateDate: Date;
  mid: Prisma.Decimal | number | string;
};

/** Upsert mid rates; returns number of rows written. */
export async function upsertFxRates(
  db: Db,
  rows: UpsertFxRateInput[],
): Promise<number> {
  let count = 0;
  for (const row of rows) {
    const currency = assertFxNbpCurrency(row.currency);
    const mid =
      row.mid instanceof Prisma.Decimal
        ? row.mid
        : new Prisma.Decimal(String(row.mid));
    if (mid.lte(0)) {
      throw new Error(`FX mid must be positive for ${currency}`);
    }
    await db.fxRateDaily.upsert({
      where: {
        rateDate_currency: { rateDate: row.rateDate, currency },
      },
      create: { rateDate: row.rateDate, currency, mid },
      update: { mid },
    });
    count += 1;
  }
  return count;
}

/**
 * Latest NBP mid for currency with rateDate <= asOf (UTC calendar).
 * Throws notFound when no row exists.
 */
export async function getMidOnOrBefore(
  db: Db,
  currency: string,
  asOf: Date,
): Promise<Prisma.Decimal> {
  const code = assertFxNbpCurrency(currency);
  const asOfDay = utcDateFromYmd(formatYmdUtc(asOf));
  const row = await db.fxRateDaily.findFirst({
    where: { currency: code, rateDate: { lte: asOfDay } },
    orderBy: { rateDate: "desc" },
    select: { mid: true },
  });
  if (!row) {
    throw notFound(`No NBP FX rate for ${code} on or before ${formatYmdUtc(asOfDay)}`);
  }
  return row.mid;
}

export type SyncFxRatesResult = {
  from: string;
  to: string;
  upserted: number;
};

/**
 * Fetch NBP rates for EUR/USD in range and upsert into FxRateDaily.
 */
export async function syncFxRates(
  db: Db,
  options: {
    fromYmd: string;
    toYmd: string;
    fetchImpl?: NbpFetch;
  },
): Promise<SyncFxRatesResult> {
  const fetched = await fetchNbpRates(
    options.fromYmd,
    options.toYmd,
    options.fetchImpl,
  );
  const upserted = await upsertFxRates(
    db,
    fetched.map((r: NbpRateRow) => ({
      currency: r.currency,
      rateDate: r.rateDate,
      mid: r.mid,
    })),
  );
  return { from: options.fromYmd, to: options.toYmd, upserted };
}

/** Inclusive default window ending today UTC. */
export function defaultSyncRange(days = 30): { fromYmd: string; toYmd: string } {
  const to = new Date();
  const toYmd = formatYmdUtc(
    new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate())),
  );
  const fromDate = utcDateFromYmd(toYmd);
  fromDate.setUTCDate(fromDate.getUTCDate() - (Math.max(1, days) - 1));
  return { fromYmd: formatYmdUtc(fromDate), toYmd };
}
