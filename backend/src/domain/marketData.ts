import type { PrismaClient } from "@prisma/client";
import { getMarketLiveApi } from "./appConfig";
import { upsertCatalogInstruments } from "./instruments";
import { formatYmdUtc } from "./fx";
import {
  getLatestValuation,
  getLatestValuationsByInstrumentIds,
  isValuationFresh,
} from "./instrumentValuations";
import {
  fetchTwelveDataEtfs,
  fetchTwelveDataStocks,
  type TwelveDataFetch,
} from "./twelveDataClient";
import type { YahooFetch } from "./yahooFinanceClient";
import { upsertYahooLatestClose } from "./yahooHistory";

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

/** Shared fetch for Yahoo quotes (and catalog uses Twelve Data separately). */
export type MarketDataFetch = YahooFetch;

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
  /**
   * When true, only instruments on some watchlist (optionally filtered by userId).
   * Default false: sync all allowlisted instruments (markets universe).
   */
  watchlistOnly?: boolean;
  /** When set with watchlistOnly, only this user's watchlist instruments. */
  userId?: number;
  /** Force refresh even if valuation looks fresh. */
  force?: boolean;
  fetchImpl?: MarketDataFetch;
  /** @deprecated Ignored — valuations use Yahoo (no API key). */
  apiKey?: string;
  /** @deprecated Ignored — Oanor GPW quote path is dormant. */
  oanorApiKey?: string;
  now?: Date;
  /** Delay between Yahoo quote calls (ms). */
  delayMs?: number;
};

type InstrumentLite = {
  id: number;
  symbol: string;
  providerSymbol: string;
  currency: string;
  exchange: string;
  country: string | null;
  assetClass: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Fetch closes for allowlisted instruments (default) or watchlist-only via Yahoo.
 * Twelve Data / Oanor quote paths are dormant (future per-user API keys).
 */
export async function syncWatchlistQuotes(
  prisma: PrismaClient,
  options: SyncQuotesOptions = {},
): Promise<SyncQuotesResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? new Date();
  const force = options.force === true;
  const watchlistOnly = options.watchlistOnly === true;
  const delayMs = options.delayMs ?? 200;

  let instruments: InstrumentLite[];
  if (watchlistOnly) {
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
    instruments = (await prisma.instrument.findMany({
      where: { id: { in: instrumentIds } },
    })) as InstrumentLite[];
  } else {
    instruments = (await prisma.instrument.findMany({
      where: { allowlisted: true },
    })) as InstrumentLite[];
    if (instruments.length === 0) {
      return {
        attempted: 0,
        updated: 0,
        skippedFresh: 0,
        failed: 0,
        errors: [],
      };
    }
  }

  let updated = 0;
  let skippedFresh = 0;
  let failed = 0;
  const errors: SyncQuotesResult["errors"] = [];

  const latestById = force
    ? new Map<number, { asOfDate: Date }>()
    : await getLatestValuationsByInstrumentIds(
        prisma,
        instruments.map((i) => i.id),
      );

  for (const instrument of instruments) {
    const latest = latestById.get(instrument.id);
    if (!force && latest && isValuationFresh(latest.asOfDate, now)) {
      skippedFresh += 1;
      continue;
    }
    try {
      if (delayMs > 0) await sleep(delayMs);
      await upsertYahooLatestClose(prisma, instrument, { fetchImpl });
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
  fetchImpl: MarketDataFetch = fetch,
  now: Date = new Date(),
  _apiKey?: string,
  _oanorApiKey?: string,
): Promise<{ fetched: boolean; asOfYmd: string | null; close: number | null }> {
  if (!(await getMarketLiveApi(prisma))) {
    const latestOffline = await getLatestValuation(prisma, instrumentId);
    return {
      fetched: false,
      asOfYmd: latestOffline ? formatYmdUtc(latestOffline.asOfDate) : null,
      close: latestOffline ? Number(latestOffline.close) : null,
    };
  }

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

  const quote = await upsertYahooLatestClose(prisma, instrument, { fetchImpl });
  return {
    fetched: true,
    asOfYmd: quote.asOfYmd,
    close: quote.close,
  };
}
