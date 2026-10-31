import { Prisma, type PrismaClient } from "@prisma/client";
import { badRequest } from "../lib/errors";
import { formatYmdUtc, utcDateFromYmd } from "./fx";

export const VALUATION_SOURCE_TWELVE_DATA = "twelve_data";
export const VALUATION_SOURCE_OANOR_GPW = "oanor_gpw";
export const VALUATION_SOURCE_STOOQ = "stooq";

/** Higher = preferred when collapsing multiple sources for one calendar day. */
const SOURCE_PRIORITY: Record<string, number> = {
  [VALUATION_SOURCE_TWELVE_DATA]: 3,
  [VALUATION_SOURCE_STOOQ]: 2,
  [VALUATION_SOURCE_OANOR_GPW]: 1,
};

const HISTORY_MONTHS = new Set([3, 6, 12]);

type Db = PrismaClient | Prisma.TransactionClient;

export type InstrumentClosePoint = {
  asOf: string;
  close: number;
};

export type InstrumentValuationRow = {
  id: number;
  instrumentId: number;
  asOfDate: Date;
  close: Prisma.Decimal;
  source: string;
  createdAt: Date;
};

/** True if asOfDate is today or yesterday UTC (good enough “fresh EOD” for hobby). */
export function isValuationFresh(
  asOfDate: Date,
  now: Date = new Date(),
): boolean {
  const today = formatYmdUtc(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
  );
  const yesterdayDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1),
  );
  const yesterday = formatYmdUtc(yesterdayDate);
  const ymd = formatYmdUtc(asOfDate);
  return ymd === today || ymd === yesterday;
}

/**
 * Latest valuation for an instrument. When `source` is omitted, returns the
 * newest row across providers (Twelve Data, Oanor GPW, …).
 */
export async function getLatestValuation(
  db: Db,
  instrumentId: number,
  source?: string,
): Promise<InstrumentValuationRow | null> {
  return db.instrumentValuation.findFirst({
    where: {
      instrumentId,
      ...(source != null ? { source } : {}),
    },
    orderBy: { asOfDate: "desc" },
  });
}

export async function upsertInstrumentClose(
  db: Db,
  input: {
    instrumentId: number;
    asOfYmd: string;
    close: number | string | Prisma.Decimal;
    source?: string;
  },
): Promise<InstrumentValuationRow> {
  const asOfDate = utcDateFromYmd(input.asOfYmd);
  const close =
    input.close instanceof Prisma.Decimal
      ? input.close
      : new Prisma.Decimal(String(input.close));
  const source = input.source ?? VALUATION_SOURCE_TWELVE_DATA;
  return db.instrumentValuation.upsert({
    where: {
      instrumentId_asOfDate_source: {
        instrumentId: input.instrumentId,
        asOfDate,
        source,
      },
    },
    create: {
      instrumentId: input.instrumentId,
      asOfDate,
      close,
      source,
    },
    update: { close },
  });
}

export function parseInstrumentHistoryMonths(value: unknown): number {
  if (value === undefined || value === null || value === "") {
    return 12;
  }
  const n = Number(value);
  if (!Number.isInteger(n) || !HISTORY_MONTHS.has(n)) {
    throw badRequest("months must be 3, 6, or 12");
  }
  return n;
}

/** UTC window ending at `now` (inclusive toYmd = today UTC). */
export function historyWindowFromMonths(
  months: number,
  now: Date = new Date(),
): { fromYmd: string; toYmd: string } {
  const to = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const from = new Date(
    Date.UTC(to.getUTCFullYear(), to.getUTCMonth() - months, to.getUTCDate()),
  );
  return { fromYmd: formatYmdUtc(from), toYmd: formatYmdUtc(to) };
}

export function sourcePriority(source: string): number {
  return SOURCE_PRIORITY[source] ?? 0;
}

/** One close per calendar day; prefers twelve_data > stooq > oanor_gpw. */
export function collapseClosesByDay(
  rows: Array<{ asOfDate: Date; close: Prisma.Decimal | number; source: string }>,
): InstrumentClosePoint[] {
  const byDay = new Map<
    string,
    { close: number; priority: number }
  >();
  for (const row of rows) {
    const asOf = formatYmdUtc(row.asOfDate);
    const close = Number(row.close);
    if (!Number.isFinite(close)) continue;
    const priority = sourcePriority(row.source);
    const existing = byDay.get(asOf);
    if (!existing || priority > existing.priority) {
      byDay.set(asOf, { close, priority });
    }
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([asOf, v]) => ({ asOf, close: v.close }));
}

export async function listInstrumentCloses(
  db: Db,
  instrumentId: number,
  range: { fromYmd: string; toYmd: string },
): Promise<InstrumentClosePoint[]> {
  const fromDate = utcDateFromYmd(range.fromYmd);
  const toDate = utcDateFromYmd(range.toYmd);
  const rows = await db.instrumentValuation.findMany({
    where: {
      instrumentId,
      asOfDate: { gte: fromDate, lte: toDate },
    },
    orderBy: [{ asOfDate: "asc" }, { source: "asc" }],
    select: { asOfDate: true, close: true, source: true },
  });
  return collapseClosesByDay(rows);
}

/** Distinct calendar days with any valuation in the inclusive window. */
export async function countDistinctClosesInWindow(
  db: Db,
  instrumentId: number,
  range: { fromYmd: string; toYmd: string },
): Promise<number> {
  const points = await listInstrumentCloses(db, instrumentId, range);
  return points.length;
}
