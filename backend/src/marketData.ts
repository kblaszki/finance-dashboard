import type { PrismaClient } from "@prisma/client";
import { findOrCreateAsset, getLatestPricesBySymbols } from "./assets";

export type MarketDataStatus = "fresh" | "stale" | "expired" | "missing";

export type EodPrice = {
  symbol: string;
  exchange?: string | null;
  currency: string;
  close: number;
  priceDate: Date;
  source: string;
};

export type EodPricePoint = EodPrice;

export type RefreshResult = {
  requested: number;
  updated: number;
  skipped: number;
  errors: Array<{ symbol: string; error: string }>;
};

export interface EodPriceProvider {
  readonly source: string;
  fetchLastClose(symbol: string): Promise<EodPrice>;
  fetchDailyHistory(symbol: string, startDate: Date, endDate: Date): Promise<EodPricePoint[]>;
}

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

type TwelveDataSeriesValue = {
  datetime?: string;
  close?: string;
};

type TwelveDataSeriesResponse = {
  meta?: { exchange?: string; currency?: string; symbol?: string };
  values?: TwelveDataSeriesValue[];
  status?: string;
  message?: string;
  code?: number;
};

function parseTwelveDataPriceDate(datetime: string | undefined): Date {
  if (!datetime) return new Date();
  if (datetime.length === 10) {
    return new Date(`${datetime}T00:00:00.000Z`);
  }
  return new Date(datetime.replace(" ", "T") + "Z");
}

export class TwelveDataProvider implements EodPriceProvider {
  readonly source = "twelve_data";
  private readonly apiKey: string;

  constructor() {
    const key = process.env.MARKET_DATA_API_KEY?.trim();
    if (!key) throw new Error("MARKET_DATA_API_KEY is not set");
    this.apiKey = key;
  }

  async fetchLastClose(symbol: string): Promise<EodPrice> {
    const history = await this.fetchDailyHistory(symbol, new Date(Date.now() - 14 * 86400000), new Date());
    if (!history.length) throw new Error(`No price data for ${symbol}`);
    return history.reduce((a, b) => (a.priceDate >= b.priceDate ? a : b));
  }

  async fetchDailyHistory(symbol: string, startDate: Date, endDate: Date): Promise<EodPricePoint[]> {
    const start = startDate.toISOString().slice(0, 10);
    const end = endDate.toISOString().slice(0, 10);
    const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&start_date=${start}&end_date=${end}&apikey=${this.apiKey}`;
    const res = await fetch(url);
    const data = (await res.json()) as TwelveDataSeriesResponse;
    if (data.status === "error" || !data.values?.length) {
      throw new Error(data.message ?? `Failed to fetch ${symbol}`);
    }
    const exchange = data.meta?.exchange ?? null;
    const currency = (data.meta?.currency ?? "USD").toUpperCase();
    return data.values
      .filter((p) => p.close != null && p.datetime)
      .map((p) => ({
        symbol: normalizeSymbol(data.meta?.symbol ?? symbol),
        exchange,
        currency,
        close: Number(p.close),
        priceDate: parseTwelveDataPriceDate(p.datetime),
        source: this.source,
      }));
  }
}

export function classifyMarketDataStatus(
  now: Date,
  priceDate: Date | null | undefined,
  staleAfterDays = 2,
  expireAfterDays = 7,
): MarketDataStatus {
  if (!priceDate) return "missing";
  const msDiff = now.getTime() - priceDate.getTime();
  const days = Math.floor(msDiff / (24 * 60 * 60 * 1000));
  if (days > expireAfterDays) return "expired";
  if (days > staleAfterDays) return "stale";
  return "fresh";
}

export async function getLatestSnapshotsForSymbols(prisma: PrismaClient, rawSymbols: string[]) {
  return getLatestPricesBySymbols(prisma, rawSymbols);
}

export async function upsertPriceHistoryForAsset(
  prisma: PrismaClient,
  assetId: number,
  points: EodPricePoint[],
): Promise<{ insertedOrUpdated: number }> {
  let insertedOrUpdated = 0;
  for (const point of points) {
    await prisma.marketPriceDaily.upsert({
      where: {
        assetId_priceDate_source: {
          assetId,
          priceDate: point.priceDate,
          source: point.source,
        },
      },
      create: {
        assetId,
        close: point.close,
        priceDate: point.priceDate,
        source: point.source,
        fetchedAt: new Date(),
      },
      update: {
        close: point.close,
        fetchedAt: new Date(),
      },
    });
    insertedOrUpdated += 1;
  }
  return { insertedOrUpdated };
}

export async function refreshSymbolsIncremental(
  prisma: PrismaClient,
  provider: EodPriceProvider,
  rawSymbols: string[],
  defaultCurrency = "USD",
): Promise<RefreshResult> {
  const symbols = [...new Set(rawSymbols.map(normalizeSymbol).filter(Boolean))];
  const result: RefreshResult = {
    requested: symbols.length,
    updated: 0,
    skipped: 0,
    errors: [],
  };
  const end = new Date();

  for (const symbol of symbols) {
    try {
      const asset = await findOrCreateAsset(prisma, symbol, defaultCurrency);
      const latest = await prisma.marketPriceDaily.findFirst({
        where: { assetId: asset.id, source: provider.source },
        orderBy: { priceDate: "desc" },
      });
      const start = latest
        ? new Date(latest.priceDate.getTime() + 86400000)
        : new Date(Date.UTC(2020, 0, 1));
      if (start > end) {
        result.skipped += 1;
        continue;
      }
      const points = await provider.fetchDailyHistory(symbol, start, end);
      if (points.length) {
        await upsertPriceHistoryForAsset(prisma, asset.id, points);
        result.updated += 1;
      } else {
        result.skipped += 1;
      }
    } catch (error) {
      result.errors.push({
        symbol,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  result.skipped = Math.max(0, result.requested - result.updated - result.errors.length);
  return result;
}
