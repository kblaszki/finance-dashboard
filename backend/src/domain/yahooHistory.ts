import type { PrismaClient } from "@prisma/client";
import {
  countDistinctClosesInWindow,
  historyWindowFromMonths,
  upsertInstrumentClose,
  VALUATION_SOURCE_YAHOO,
} from "./instrumentValuations";
import {
  fetchYahooDailyHistory,
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
      for (const bar of bars) {
        await upsertInstrumentClose(prisma, {
          instrumentId: instrument.id,
          asOfYmd: bar.asOfYmd,
          close: bar.close,
          source: VALUATION_SOURCE_YAHOO,
        });
        barsUpserted += 1;
      }
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
