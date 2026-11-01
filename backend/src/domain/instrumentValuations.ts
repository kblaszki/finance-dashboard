import { Prisma, type PrismaClient } from "@prisma/client";
import { badRequest } from "../lib/errors";
import { formatYmdUtc, utcDateFromYmd } from "./fx";

export const VALUATION_SOURCE_TWELVE_DATA = "twelve_data";
export const VALUATION_SOURCE_OANOR_GPW = "oanor_gpw";
export const VALUATION_SOURCE_STOOQ = "stooq";
export const VALUATION_SOURCE_YAHOO = "yahoo";

/** Higher = preferred when collapsing multiple sources for one calendar day. */
const SOURCE_PRIORITY: Record<string, number> = {
  [VALUATION_SOURCE_YAHOO]: 4,
  [VALUATION_SOURCE_TWELVE_DATA]: 3,
  [VALUATION_SOURCE_STOOQ]: 2,
  [VALUATION_SOURCE_OANOR_GPW]: 1,
};

const HISTORY_MONTHS = new Set([3, 6, 12]);
const HISTORY_YEAR_MIN = 1990;

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

type LatestValuationRaw = {
  id: number | bigint;
  instrumentId: number | bigint;
  asOfDate: Date | string;
  close: Prisma.Decimal | string | number;
  source: string;
  createdAt: Date | string;
};

function mapRawValuationRow(row: LatestValuationRaw): InstrumentValuationRow {
  return {
    id: Number(row.id),
    instrumentId: Number(row.instrumentId),
    asOfDate:
      row.asOfDate instanceof Date ? row.asOfDate : new Date(row.asOfDate),
    close:
      row.close instanceof Prisma.Decimal
        ? row.close
        : new Prisma.Decimal(String(row.close)),
    source: String(row.source),
    createdAt:
      row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
  };
}

/**
 * Latest valuation per instrument id via SQL MAX(asOfDate) join — does not
 * load full EOD history into memory. When multiple sources share the max day,
 * prefers higher sourcePriority (yahoo > twelve_data > …).
 */
export async function getLatestValuationsByInstrumentIds(
  db: Db,
  instrumentIds: number[],
  source?: string,
): Promise<Map<number, InstrumentValuationRow>> {
  const out = new Map<number, InstrumentValuationRow>();
  const unique = [
    ...new Set(instrumentIds.filter((id) => Number.isInteger(id) && id > 0)),
  ];
  if (unique.length === 0) return out;

  const rows =
    source != null
      ? await db.$queryRaw<LatestValuationRaw[]>`
          SELECT v.id, v.instrumentId, v.asOfDate, v.close, v.source, v.createdAt
          FROM InstrumentValuation v
          INNER JOIN (
            SELECT instrumentId, MAX(asOfDate) AS maxAsOf
            FROM InstrumentValuation
            WHERE instrumentId IN (${Prisma.join(unique)})
              AND source = ${source}
            GROUP BY instrumentId
          ) latest
            ON latest.instrumentId = v.instrumentId
           AND latest.maxAsOf = v.asOfDate
          WHERE v.source = ${source}
        `
      : await db.$queryRaw<LatestValuationRaw[]>`
          SELECT v.id, v.instrumentId, v.asOfDate, v.close, v.source, v.createdAt
          FROM InstrumentValuation v
          INNER JOIN (
            SELECT instrumentId, MAX(asOfDate) AS maxAsOf
            FROM InstrumentValuation
            WHERE instrumentId IN (${Prisma.join(unique)})
            GROUP BY instrumentId
          ) latest
            ON latest.instrumentId = v.instrumentId
           AND latest.maxAsOf = v.asOfDate
        `;

  for (const raw of rows) {
    const row = mapRawValuationRow(raw);
    const prev = out.get(row.instrumentId);
    if (
      !prev ||
      sourcePriority(row.source) > sourcePriority(prev.source)
    ) {
      out.set(row.instrumentId, row);
    }
  }
  return out;
}

/**
 * Latest valuation per instrument with asOfDate strictly before `before`
 * (carry-forward for month-replay windows).
 */
export async function getLatestValuationsBeforeDate(
  db: Db,
  instrumentIds: number[],
  before: Date,
): Promise<
  Array<{
    instrumentId: number;
    asOfDate: Date;
    close: Prisma.Decimal | number;
    source: string;
  }>
> {
  const unique = [
    ...new Set(instrumentIds.filter((id) => Number.isInteger(id) && id > 0)),
  ];
  if (unique.length === 0) return [];

  const rows = await db.$queryRaw<LatestValuationRaw[]>`
    SELECT v.id, v.instrumentId, v.asOfDate, v.close, v.source, v.createdAt
    FROM InstrumentValuation v
    INNER JOIN (
      SELECT instrumentId, MAX(asOfDate) AS maxAsOf
      FROM InstrumentValuation
      WHERE instrumentId IN (${Prisma.join(unique)})
        AND asOfDate < ${before}
      GROUP BY instrumentId
    ) latest
      ON latest.instrumentId = v.instrumentId
     AND latest.maxAsOf = v.asOfDate
  `;

  const byId = new Map<number, InstrumentValuationRow>();
  for (const raw of rows) {
    const row = mapRawValuationRow(raw);
    const prev = byId.get(row.instrumentId);
    if (
      !prev ||
      sourcePriority(row.source) > sourcePriority(prev.source)
    ) {
      byId.set(row.instrumentId, row);
    }
  }
  return [...byId.values()].map((row) => ({
    instrumentId: row.instrumentId,
    asOfDate: row.asOfDate,
    close: row.close,
    source: row.source,
  }));
}

/**
 * Valuations for holdings month-replay: dense rows in [windowStart, exclusiveEnd)
 * plus one carry-forward close per instrument before windowStart.
 */
export async function loadValuationsForAsOfReplay(
  db: Db,
  instrumentIds: number[],
  windowStart: Date,
  exclusiveEnd: Date,
): Promise<
  Array<{
    instrumentId: number;
    asOfDate: Date;
    close: Prisma.Decimal | number;
    source: string;
  }>
> {
  const unique = [
    ...new Set(instrumentIds.filter((id) => Number.isInteger(id) && id > 0)),
  ];
  if (unique.length === 0) return [];

  const [inWindow, prior] = await Promise.all([
    db.instrumentValuation.findMany({
      where: {
        instrumentId: { in: unique },
        asOfDate: { gte: windowStart, lt: exclusiveEnd },
      },
      select: {
        instrumentId: true,
        asOfDate: true,
        close: true,
        source: true,
      },
    }),
    getLatestValuationsBeforeDate(db, unique, windowStart),
  ]);

  return [...prior, ...inWindow];
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

/**
 * Batch upsert closes for one instrument in a single interactive transaction
 * (avoids sequential await between each bar).
 */
export async function upsertInstrumentClosesBatch(
  db: PrismaClient,
  instrumentId: number,
  bars: Array<{ asOfYmd: string; close: number | string | Prisma.Decimal }>,
  source: string = VALUATION_SOURCE_TWELVE_DATA,
): Promise<number> {
  if (bars.length === 0) return 0;
  await db.$transaction(
    bars.map((bar) => {
      const asOfDate = utcDateFromYmd(bar.asOfYmd);
      const close =
        bar.close instanceof Prisma.Decimal
          ? bar.close
          : new Prisma.Decimal(String(bar.close));
      return db.instrumentValuation.upsert({
        where: {
          instrumentId_asOfDate_source: {
            instrumentId,
            asOfDate,
            source,
          },
        },
        create: {
          instrumentId,
          asOfDate,
          close,
          source,
        },
        update: { close },
      });
    }),
  );
  return bars.length;
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

/**
 * Optional calendar year for chart paging. Empty → null (use months window).
 * Accepts 1990 … current UTC year.
 */
export function parseInstrumentHistoryYear(
  value: unknown,
  now: Date = new Date(),
): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const n = Number(value);
  const maxYear = now.getUTCFullYear();
  if (!Number.isInteger(n) || n < HISTORY_YEAR_MIN || n > maxYear) {
    throw badRequest(
      `year must be an integer from ${HISTORY_YEAR_MIN} to ${maxYear}`,
    );
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

/** Inclusive UTC calendar year; current year ends today. */
export function historyWindowForYear(
  year: number,
  now: Date = new Date(),
): { fromYmd: string; toYmd: string } {
  const fromYmd = `${year}-01-01`;
  const currentYear = now.getUTCFullYear();
  if (year < currentYear) {
    return { fromYmd, toYmd: `${year}-12-31` };
  }
  const to = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  return { fromYmd, toYmd: formatYmdUtc(to) };
}

export function sourcePriority(source: string): number {
  return SOURCE_PRIORITY[source] ?? 0;
}

/** One close per calendar day; prefers yahoo > twelve_data > stooq > oanor_gpw. */
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

/** UTC years spanning stored closes (any source) for chart year paging. */
export async function instrumentCloseYearBounds(
  db: Db,
  instrumentId: number,
): Promise<{ oldestYear: number | null; newestYear: number | null }> {
  const [oldest, newest] = await Promise.all([
    db.instrumentValuation.findFirst({
      where: { instrumentId },
      orderBy: { asOfDate: "asc" },
      select: { asOfDate: true },
    }),
    db.instrumentValuation.findFirst({
      where: { instrumentId },
      orderBy: { asOfDate: "desc" },
      select: { asOfDate: true },
    }),
  ]);
  return {
    oldestYear: oldest ? oldest.asOfDate.getUTCFullYear() : null,
    newestYear: newest ? newest.asOfDate.getUTCFullYear() : null,
  };
}
