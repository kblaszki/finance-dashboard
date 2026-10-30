import type { PrismaClient } from "@prisma/client";
import {
  INSTRUMENT_PROVIDER_TWELVE_DATA,
  upsertCatalogInstruments,
} from "./instruments";
import { formatYmdUtc } from "./fx";
import {
  getLatestValuation,
  isValuationFresh,
  upsertInstrumentClose,
} from "./instrumentValuations";
import {
  createCreditPacer,
  fetchTwelveDataEodQuote,
  fetchTwelveDataEtfs,
  fetchTwelveDataStocks,
  type TwelveDataFetch,
} from "./twelveDataClient";

export type SyncCatalogResult = {
  stocksUpserted: number;
  etfsUpserted: number;
};

export type SyncQuotesResult = {
  attempted: number;
  updated: number;
  skippedFresh: number;
  failed: number;
  errors: Array<{ instrumentId: number; symbol: string; message: string }>;
};

export async function syncInstrumentCatalog(
  prisma: PrismaClient,
  fetchImpl: TwelveDataFetch = fetch,
  apiKey?: string,
): Promise<SyncCatalogResult> {
  const stocks = await fetchTwelveDataStocks(fetchImpl, apiKey);
  const etfs = await fetchTwelveDataEtfs(fetchImpl, apiKey);
  const stocksUpserted = await upsertCatalogInstruments(prisma, "STOCK", stocks);
  const etfsUpserted = await upsertCatalogInstruments(prisma, "ETF", etfs);
  return { stocksUpserted, etfsUpserted };
}

export type SyncQuotesOptions = {
  /** When set, only this user's watchlist instruments. */
  userId?: number;
  /** Force refresh even if valuation looks fresh. */
  force?: boolean;
  fetchImpl?: TwelveDataFetch;
  apiKey?: string;
  now?: Date;
};

/**
 * Fetch EOD closes for instruments that appear on at least one watchlist.
 * Paces requests for free-tier credit limits.
 */
export async function syncWatchlistQuotes(
  prisma: PrismaClient,
  options: SyncQuotesOptions = {},
): Promise<SyncQuotesResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? new Date();
  const force = options.force === true;

  const watchRows = await prisma.watchlistItem.findMany({
    where: options.userId != null ? { userId: options.userId } : undefined,
    select: { instrumentId: true },
    distinct: ["instrumentId"],
  });
  const instrumentIds = watchRows.map((r) => r.instrumentId);
  if (instrumentIds.length === 0) {
    return {
      attempted: 0,
      updated: 0,
      skippedFresh: 0,
      failed: 0,
      errors: [],
    };
  }

  const instruments = await prisma.instrument.findMany({
    where: {
      id: { in: instrumentIds },
      provider: INSTRUMENT_PROVIDER_TWELVE_DATA,
    },
  });

  const pace = createCreditPacer();
  let updated = 0;
  let skippedFresh = 0;
  let failed = 0;
  const errors: SyncQuotesResult["errors"] = [];

  for (const instrument of instruments) {
    const latest = await getLatestValuation(prisma, instrument.id);
    if (!force && latest && isValuationFresh(latest.asOfDate, now)) {
      skippedFresh += 1;
      continue;
    }
    try {
      await pace();
      const quote = await fetchTwelveDataEodQuote(
        instrument.providerSymbol,
        fetchImpl,
        options.apiKey,
      );
      await upsertInstrumentClose(prisma, {
        instrumentId: instrument.id,
        asOfYmd: quote.asOfYmd,
        close: quote.close,
      });
      if (quote.currency && quote.currency !== instrument.currency) {
        await prisma.instrument.update({
          where: { id: instrument.id },
          data: { currency: quote.currency },
        });
      }
      updated += 1;
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
    updated,
    skippedFresh,
    failed,
    errors,
  };
}

/** Ensure one instrument has a fresh valuation (used on watchlist add). */
export async function ensureInstrumentQuote(
  prisma: PrismaClient,
  instrumentId: number,
  fetchImpl: TwelveDataFetch = fetch,
  now: Date = new Date(),
  apiKey?: string,
): Promise<{ fetched: boolean; asOfYmd: string | null; close: number | null }> {
  const instrument = await prisma.instrument.findUnique({
    where: { id: instrumentId },
  });
  if (!instrument || instrument.provider !== INSTRUMENT_PROVIDER_TWELVE_DATA) {
    return { fetched: false, asOfYmd: null, close: null };
  }
  const latest = await getLatestValuation(prisma, instrumentId);
  if (latest && isValuationFresh(latest.asOfDate, now)) {
    return {
      fetched: false,
      asOfYmd: formatYmdUtc(latest.asOfDate),
      close: Number(latest.close),
    };
  }
  const quote = await fetchTwelveDataEodQuote(
    instrument.providerSymbol,
    fetchImpl,
    apiKey,
  );
  const row = await upsertInstrumentClose(prisma, {
    instrumentId,
    asOfYmd: quote.asOfYmd,
    close: quote.close,
  });
  if (quote.currency && quote.currency !== instrument.currency) {
    await prisma.instrument.update({
      where: { id: instrumentId },
      data: { currency: quote.currency },
    });
  }
  return {
    fetched: true,
    asOfYmd: quote.asOfYmd,
    close: Number(row.close),
  };
}
