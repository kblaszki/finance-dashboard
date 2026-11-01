import type { PrismaClient } from "@prisma/client";
import {
  claimYahooGapSyncLastRunYmd,
  getYahooGapSyncLastRunYmd,
} from "./appConfig";
import { formatYmdUtc } from "./fx";
import {
  countDistinctClosesInWindow,
  getLatestValuation,
  getLatestValuationsByInstrumentIds,
  historyWindowFromMonths,
  isValuationFresh,
  upsertInstrumentClose,
  upsertInstrumentClosesBatch,
  VALUATION_SOURCE_YAHOO,
} from "./instrumentValuations";
import {
  fetchYahooDailyHistory,
  type YahooBar,
  type YahooFetch,
} from "./yahooFinanceClient";
import { yahooSymbolForInstrument } from "./yahooSymbols";

export type SyncYahooHistoryResult = {
  attempted: number;
  updatedInstruments: number;
  barsUpserted: number;
  skipped: number;
  failed: number;
  errors: Array<{ instrumentId: number; symbol: string; message: string }>;
};

export type SyncYahooHistoryOptions = {
  instrumentId?: number;
  /** When set, only instruments on this user's watchlist. */
  userId?: number;
  /** All allowlisted (default when no userId/instrumentId). */
  allowlistedOnly?: boolean;
  force?: boolean;
  range?: string;
  fetchImpl?: YahooFetch;
  /** Delay between Yahoo calls (ms). */
  delayMs?: number;
  sparseThreshold?: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Calendar days from last valuation UTC midnight to `now` UTC date (no valuation → large). */
export function calendarDaysSinceLastClose(
  lastAsOf: Date | null,
  now: Date = new Date(),
): number {
  if (lastAsOf == null) return Number.POSITIVE_INFINITY;
  const lastUtc = Date.UTC(
    lastAsOf.getUTCFullYear(),
    lastAsOf.getUTCMonth(),
    lastAsOf.getUTCDate(),
  );
  const nowUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return Math.max(0, Math.floor((nowUtc - lastUtc) / 86_400_000));
}

/** Yahoo chart `range` sized to cover the valuation gap. */
export function yahooRangeForGapDays(gapDays: number): string {
  if (!Number.isFinite(gapDays) || gapDays > 100) return "1y";
  if (gapDays <= 5) return "5d";
  if (gapDays <= 35) return "1mo";
  return "3mo";
}

/** Keep bars strictly after the last stored UTC day (null → all). */
export function barsAfterLastYmd(
  bars: YahooBar[],
  lastYmd: string | null,
): YahooBar[] {
  if (lastYmd == null) return bars;
  return bars.filter((b) => b.asOfYmd > lastYmd);
}

export type SyncYahooGapsResult = {
  attempted: number;
  updatedInstruments: number;
  barsUpserted: number;
  skippedFresh: number;
  failed: number;
  skippedDueToDayLock: boolean;
  errors: Array<{ instrumentId: number; symbol: string; message: string }>;
};

export type SyncYahooGapsOptions = {
  force?: boolean;
  fetchImpl?: YahooFetch;
  delayMs?: number;
  now?: Date;
};

/**
 * Daily allowlist gap-fill: for each allowlisted instrument, fetch Yahoo closes
 * covering days after the latest valuation and upsert missing bars.
 * Day-lock (AppConfig) skips a second run on the same UTC day unless `force`.
 */
export async function syncYahooAllowlistGaps(
  prisma: PrismaClient,
  options: SyncYahooGapsOptions = {},
): Promise<SyncYahooGapsResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const force = options.force === true;
  const delayMs = options.delayMs ?? 200;
  const now = options.now ?? new Date();
  const todayYmd = formatYmdUtc(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
  );

  if (!force) {
    const lastRun = await getYahooGapSyncLastRunYmd(prisma);
    if (lastRun === todayYmd) {
      return {
        attempted: 0,
        updatedInstruments: 0,
        barsUpserted: 0,
        skippedFresh: 0,
        failed: 0,
        skippedDueToDayLock: true,
        errors: [],
      };
    }
  }

  const instruments = await prisma.instrument.findMany({
    where: { allowlisted: true },
    orderBy: { symbol: "asc" },
  });

  const latestById = await getLatestValuationsByInstrumentIds(
    prisma,
    instruments.map((i) => i.id),
  );

  let updatedInstruments = 0;
  let barsUpserted = 0;
  let skippedFresh = 0;
  let failed = 0;
  const errors: SyncYahooGapsResult["errors"] = [];

  for (const instrument of instruments) {
    const latest = latestById.get(instrument.id) ?? null;
    if (latest && isValuationFresh(latest.asOfDate, now)) {
      skippedFresh += 1;
      continue;
    }

    const lastYmd = latest ? formatYmdUtc(latest.asOfDate) : null;
    const gapDays = calendarDaysSinceLastClose(latest?.asOfDate ?? null, now);
    const range = yahooRangeForGapDays(gapDays);
    const yahooSymbol = yahooSymbolForInstrument(instrument);

    try {
      if (delayMs > 0) await sleep(delayMs);
      const bars = await fetchYahooDailyHistory(yahooSymbol, {
        range,
        fetchImpl,
      });
      const toUpsert = barsAfterLastYmd(bars, lastYmd);
      if (toUpsert.length === 0) {
        if (bars.length === 0) {
          failed += 1;
          errors.push({
            instrumentId: instrument.id,
            symbol: instrument.symbol,
            message: `Yahoo returned no bars for ${yahooSymbol}`,
          });
        } else {
          skippedFresh += 1;
        }
        continue;
      }
      barsUpserted += await upsertInstrumentClosesBatch(
        prisma,
        instrument.id,
        toUpsert.map((bar) => ({
          asOfYmd: bar.asOfYmd,
          close: bar.close,
        })),
        VALUATION_SOURCE_YAHOO,
      );
      updatedInstruments += 1;
    } catch (e: unknown) {
      failed += 1;
      errors.push({
        instrumentId: instrument.id,
        symbol: instrument.symbol,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Success-only day-lock: avoid skipping retries after a total outage.
  const totalOutage =
    instruments.length > 0 && failed === instruments.length;
  const madeProgress = updatedInstruments + skippedFresh > 0;
  if (!totalOutage && (failed === 0 || madeProgress)) {
    await claimYahooGapSyncLastRunYmd(prisma, todayYmd);
  }

  return {
    attempted: instruments.length,
    updatedInstruments,
    barsUpserted,
    skippedFresh,
    failed,
    skippedDueToDayLock: false,
    errors,
  };
}

export type YahooInstrumentRef = {
  id: number;
  symbol: string;
  providerSymbol?: string | null;
  assetClass?: string | null;
  exchange?: string | null;
  country?: string | null;
};

/**
 * Latest close from Yahoo chart (`range=5d` by default) → InstrumentValuation.
 */
export async function upsertYahooLatestClose(
  prisma: PrismaClient,
  instrument: YahooInstrumentRef,
  options: { fetchImpl?: YahooFetch; range?: string } = {},
): Promise<{ asOfYmd: string; close: number }> {
  const yahooSymbol = yahooSymbolForInstrument(instrument);
  const bars = await fetchYahooDailyHistory(yahooSymbol, {
    range: options.range ?? "5d",
    ...(options.fetchImpl != null ? { fetchImpl: options.fetchImpl } : {}),
  });
  if (bars.length === 0) {
    throw new Error(`Yahoo returned no bars for ${yahooSymbol}`);
  }
  const last = bars[bars.length - 1]!;
  await upsertInstrumentClose(prisma, {
    instrumentId: instrument.id,
    asOfYmd: last.asOfYmd,
    close: last.close,
    source: VALUATION_SOURCE_YAHOO,
  });
  return { asOfYmd: last.asOfYmd, close: last.close };
}

/**
 * Backfill daily closes from Yahoo chart API into InstrumentValuation.
 * Default range `1y`; use `range: "10y"` for a full allowlist dump.
 */
export async function syncYahooHistory(
  prisma: PrismaClient,
  options: SyncYahooHistoryOptions = {},
): Promise<SyncYahooHistoryResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const force = options.force === true;
  const delayMs = options.delayMs ?? 200;
  const range = options.range ?? "1y";
  const threshold = options.sparseThreshold ?? 20;
  // Sparse check uses ~12m window even when fetching 10y (skip if already dense recently).
  const window = historyWindowFromMonths(12);

  let instruments: Array<{
    id: number;
    symbol: string;
    providerSymbol: string;
    assetClass: string;
    exchange: string;
    country: string | null;
  }>;

  if (options.instrumentId != null) {
    instruments = await prisma.instrument.findMany({
      where: { id: options.instrumentId },
    });
  } else if (options.userId != null) {
    const items = await prisma.watchlistItem.findMany({
      where: { userId: options.userId },
      include: { instrument: true },
    });
    instruments = items.map((i) => i.instrument);
  } else {
    instruments = await prisma.instrument.findMany({
      where: { allowlisted: true },
      orderBy: { symbol: "asc" },
    });
  }

  let updatedInstruments = 0;
  let barsUpserted = 0;
  let skipped = 0;
  let failed = 0;
  const errors: SyncYahooHistoryResult["errors"] = [];

  for (const instrument of instruments) {
    if (!force) {
      const existing = await countDistinctClosesInWindow(
        prisma,
        instrument.id,
        window,
      );
      if (existing >= threshold) {
        skipped += 1;
        continue;
      }
    }

    const yahooSymbol = yahooSymbolForInstrument(instrument);
    try {
      if (delayMs > 0) await sleep(delayMs);
      const bars = await fetchYahooDailyHistory(yahooSymbol, {
        range,
        fetchImpl,
      });
      if (bars.length === 0) {
        failed += 1;
        errors.push({
          instrumentId: instrument.id,
          symbol: instrument.symbol,
          message: `Yahoo returned no bars for ${yahooSymbol}`,
        });
        continue;
      }
      barsUpserted += await upsertInstrumentClosesBatch(
        prisma,
        instrument.id,
        bars.map((bar) => ({
          asOfYmd: bar.asOfYmd,
          close: bar.close,
        })),
        VALUATION_SOURCE_YAHOO,
      );
      updatedInstruments += 1;
    } catch (e: unknown) {
      failed += 1;
      errors.push({
        instrumentId: instrument.id,
        symbol: instrument.symbol,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return {
    attempted: instruments.length,
    updatedInstruments,
    barsUpserted,
    skipped,
    failed,
    errors,
  };
}
