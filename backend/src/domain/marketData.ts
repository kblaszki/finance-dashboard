import type { PrismaClient } from "@prisma/client";
import {
  isGpwListed,
  upsertCatalogInstruments,
} from "./instruments";
import { formatYmdUtc } from "./fx";
import {
  getLatestValuation,
  isValuationFresh,
  upsertInstrumentClose,
  VALUATION_SOURCE_OANOR_GPW,
  VALUATION_SOURCE_TWELVE_DATA,
} from "./instrumentValuations";
import {
  createRpsPacer,
  fetchOanorGpwQuotes,
  OANOR_GPW_QUOTE_BATCH_SIZE,
  type OanorFetch,
} from "./oanorGpwClient";
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

/** Shared fetch shape: URL + optional RequestInit (Oanor needs headers). */
export type MarketDataFetch = OanorFetch;

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
  fetchImpl?: MarketDataFetch;
  /** Twelve Data API key (non-GPW quotes). */
  apiKey?: string;
  /** Oanor API key (GPW quotes). */
  oanorApiKey?: string;
  now?: Date;
};

type InstrumentLite = {
  id: number;
  symbol: string;
  providerSymbol: string;
  currency: string;
  exchange: string;
  country: string | null;
};

async function applyQuoteCurrency(
  prisma: PrismaClient,
  instrument: InstrumentLite,
  currency: string | null,
): Promise<void> {
  if (currency && currency !== instrument.currency) {
    await prisma.instrument.update({
      where: { id: instrument.id },
      data: { currency },
    });
  }
}

async function syncTwelveDataInstrument(
  prisma: PrismaClient,
  instrument: InstrumentLite,
  fetchImpl: MarketDataFetch,
  apiKey: string | undefined,
): Promise<void> {
  const quote = await fetchTwelveDataEodQuote(
    instrument.providerSymbol,
    fetchImpl,
    apiKey,
  );
  await upsertInstrumentClose(prisma, {
    instrumentId: instrument.id,
    asOfYmd: quote.asOfYmd,
    close: quote.close,
    source: VALUATION_SOURCE_TWELVE_DATA,
  });
  await applyQuoteCurrency(prisma, instrument, quote.currency);
}

async function syncOanorGpwBatch(
  prisma: PrismaClient,
  batch: InstrumentLite[],
  fetchImpl: MarketDataFetch,
  oanorApiKey: string | undefined,
  now: Date,
): Promise<{
  updated: number;
  failed: number;
  errors: SyncQuotesResult["errors"];
}> {
  const errors: SyncQuotesResult["errors"] = [];
  let updated = 0;
  let failed = 0;
  try {
    const quotes = await fetchOanorGpwQuotes(
      batch.map((i) => i.providerSymbol || i.symbol),
      fetchImpl,
      oanorApiKey,
      now,
    );
    const bySymbol = new Map(quotes.map((q) => [q.symbol, q]));
    for (const instrument of batch) {
      const key = (instrument.providerSymbol || instrument.symbol)
        .trim()
        .toUpperCase();
      const quote = bySymbol.get(key);
      if (!quote) {
        failed += 1;
        errors.push({
          instrumentId: instrument.id,
          symbol: instrument.symbol,
          message: `Oanor GPW returned no quote for ${instrument.symbol}`,
        });
        continue;
      }
      await upsertInstrumentClose(prisma, {
        instrumentId: instrument.id,
        asOfYmd: quote.asOfYmd,
        close: quote.close,
        source: VALUATION_SOURCE_OANOR_GPW,
      });
      await applyQuoteCurrency(prisma, instrument, quote.currency);
      updated += 1;
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    for (const instrument of batch) {
      failed += 1;
      errors.push({
        instrumentId: instrument.id,
        symbol: instrument.symbol,
        message,
      });
    }
  }
  return { updated, failed, errors };
}

/**
 * Fetch closes for instruments on at least one watchlist.
 * GPW → Oanor (batched ≤20); others → Twelve Data (paced).
 */
export async function syncWatchlistQuotes(
  prisma: PrismaClient,
  options: SyncQuotesOptions = {},
): Promise<SyncQuotesResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? new Date();
  const force = options.force === true;

  const watchRows = await prisma.watchlistItem.findMany({
    ...(options.userId != null ? { where: { userId: options.userId } } : {}),
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

  const instruments = (await prisma.instrument.findMany({
    where: { id: { in: instrumentIds } },
  })) as InstrumentLite[];

  let updated = 0;
  let skippedFresh = 0;
  let failed = 0;
  const errors: SyncQuotesResult["errors"] = [];

  const needGpw: InstrumentLite[] = [];
  const needTd: InstrumentLite[] = [];

  for (const instrument of instruments) {
    const latest = await getLatestValuation(prisma, instrument.id);
    if (!force && latest && isValuationFresh(latest.asOfDate, now)) {
      skippedFresh += 1;
      continue;
    }
    if (isGpwListed(instrument)) needGpw.push(instrument);
    else needTd.push(instrument);
  }

  const oanorPace = createRpsPacer();
  for (let i = 0; i < needGpw.length; i += OANOR_GPW_QUOTE_BATCH_SIZE) {
    const batch = needGpw.slice(i, i + OANOR_GPW_QUOTE_BATCH_SIZE);
    await oanorPace();
    const part = await syncOanorGpwBatch(
      prisma,
      batch,
      fetchImpl,
      options.oanorApiKey,
      now,
    );
    updated += part.updated;
    failed += part.failed;
    errors.push(...part.errors);
  }

  const tdPace = createCreditPacer();
  for (const instrument of needTd) {
    try {
      await tdPace();
      await syncTwelveDataInstrument(
        prisma,
        instrument,
        fetchImpl,
        options.apiKey,
      );
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

export type EnsureQuoteOptions = {
  fetchImpl?: MarketDataFetch;
  now?: Date;
  apiKey?: string;
  oanorApiKey?: string;
};

/** Ensure one instrument has a fresh valuation (used on watchlist add). */
export async function ensureInstrumentQuote(
  prisma: PrismaClient,
  instrumentId: number,
  fetchImpl: MarketDataFetch = fetch,
  now: Date = new Date(),
  apiKey?: string,
  oanorApiKey?: string,
): Promise<{ fetched: boolean; asOfYmd: string | null; close: number | null }> {
  const instrument = await prisma.instrument.findUnique({
    where: { id: instrumentId },
  });
  if (!instrument) {
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

  const lite: InstrumentLite = {
    id: instrument.id,
    symbol: instrument.symbol,
    providerSymbol: instrument.providerSymbol,
    currency: instrument.currency,
    exchange: instrument.exchange,
    country: instrument.country,
  };

  if (isGpwListed(instrument)) {
    const quotes = await fetchOanorGpwQuotes(
      [instrument.providerSymbol || instrument.symbol],
      fetchImpl,
      oanorApiKey,
      now,
    );
    const quote = quotes[0];
    if (!quote) {
      throw new Error(
        `Oanor GPW returned no quote for ${instrument.symbol}`,
      );
    }
    const row = await upsertInstrumentClose(prisma, {
      instrumentId,
      asOfYmd: quote.asOfYmd,
      close: quote.close,
      source: VALUATION_SOURCE_OANOR_GPW,
    });
    await applyQuoteCurrency(prisma, lite, quote.currency);
    return {
      fetched: true,
      asOfYmd: quote.asOfYmd,
      close: Number(row.close),
    };
  }

  await syncTwelveDataInstrument(prisma, lite, fetchImpl, apiKey);
  const row = await getLatestValuation(prisma, instrumentId);
  return {
    fetched: true,
    asOfYmd: row ? formatYmdUtc(row.asOfDate) : null,
    close: row ? Number(row.close) : null,
  };
}
