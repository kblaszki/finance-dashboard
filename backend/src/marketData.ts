export type MarketDataStatus = "fresh" | "stale" | "expired" | "missing";

export type EodPrice = {
  symbol: string;
  exchange?: string | null;
  currency: string;
  close: number;
  priceDate: Date;
  source: string;
};

export type RefreshResult = {
  requested: number;
  updated: number;
  skipped: number;
  errors: Array<{ symbol: string; error: string }>;
};

export interface EodPriceProvider {
  readonly source: string;
  fetchLastClose(symbol: string): Promise<EodPrice>;
}

type PrismaLike = {
  marketPriceSnapshot: {
    upsert(args: {
      where: {
        symbol_priceDate_source: {
          symbol: string;
          priceDate: Date;
          source: string;
        };
      };
      create: {
        symbol: string;
        exchange: string | null;
        currency: string;
        close: number;
        priceDate: Date;
        source: string;
        fetchedAt: Date;
      };
      update: {
        exchange: string | null;
        currency: string;
        close: number;
        fetchedAt: Date;
      };
    }): Promise<unknown>;
    findMany(args: {
      where: { symbol: { in: string[] } };
      orderBy: Array<{ symbol: "asc" | "desc" } | { priceDate: "asc" | "desc" } | { fetchedAt: "asc" | "desc" }>;
    }): Promise<
      Array<{
        symbol: string;
        priceDate: Date;
        fetchedAt: Date;
        close: unknown;
        currency: string;
        source: string;
      }>
    >;
  };
};

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

function normalizeCurrency(code: unknown): string {
  return String(code ?? "").trim().toUpperCase();
}

function normalizeSymbol(symbol: unknown): string {
  return String(symbol ?? "").trim().toUpperCase();
}

function parseDateOnlyToUtc(dateLike: string): Date {
  const [y, m, d] = dateLike.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 0, 0, 0, 0));
}

function parseTwelveDataPriceDate(value: string): Date {
  // Usually "YYYY-MM-DD" for 1day interval, sometimes datetime.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return parseDateOnlyToUtc(value);
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid price date: ${value}`);
  }
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

async function fetchJson(url: string): Promise<unknown> {
  const fetchFn = (globalThis as { fetch?: typeof fetch }).fetch;
  if (!fetchFn) {
    throw new Error("Global fetch() is not available (requires Node 18+).");
  }
  const res = await fetchFn(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Market data request failed (${res.status})`);
  }
  return res.json();
}

export class TwelveDataProvider implements EodPriceProvider {
  readonly source = "twelve_data";
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(opts?: { apiKey?: string; baseUrl?: string }) {
    this.apiKey = String(opts?.apiKey ?? process.env.MARKET_DATA_API_KEY ?? "").trim();
    this.baseUrl = String(opts?.baseUrl ?? "https://api.twelvedata.com").replace(/\/+$/, "");
    if (!this.apiKey) {
      throw new Error("MARKET_DATA_API_KEY is missing");
    }
  }

  async fetchLastClose(symbolInput: string): Promise<EodPrice> {
    const symbol = normalizeSymbol(symbolInput);
    if (!symbol) {
      throw new Error("Symbol is required");
    }
    const q = new URLSearchParams({
      symbol,
      interval: "1day",
      outputsize: "1",
      apikey: this.apiKey,
    });
    const payload = (await fetchJson(
      `${this.baseUrl}/time_series?${q.toString()}`,
    )) as TwelveDataSeriesResponse;

    if (payload?.status === "error") {
      throw new Error(payload.message || `Provider error code ${payload.code ?? "unknown"}`);
    }
    const point = payload.values?.[0];
    if (!point?.datetime || point.close == null) {
      throw new Error("No daily close data returned");
    }
    const close = Number(point.close);
    if (!Number.isFinite(close) || close <= 0) {
      throw new Error(`Invalid close value: ${point.close}`);
    }
    return {
      symbol,
      exchange: payload.meta?.exchange ?? null,
      currency: normalizeCurrency(payload.meta?.currency ?? "USD"),
      close,
      priceDate: parseTwelveDataPriceDate(point.datetime),
      source: this.source,
    };
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

export async function refreshSymbolsLastClose(
  prisma: PrismaLike,
  provider: EodPriceProvider,
  rawSymbols: string[],
): Promise<RefreshResult> {
  const symbols = [...new Set(rawSymbols.map(normalizeSymbol).filter(Boolean))];
  const result: RefreshResult = {
    requested: symbols.length,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  for (const symbol of symbols) {
    try {
      const quote = await provider.fetchLastClose(symbol);
      await prisma.marketPriceSnapshot.upsert({
        where: {
          symbol_priceDate_source: {
            symbol: quote.symbol,
            priceDate: quote.priceDate,
            source: quote.source,
          },
        },
        create: {
          symbol: quote.symbol,
          exchange: quote.exchange ?? null,
          currency: quote.currency,
          close: quote.close,
          priceDate: quote.priceDate,
          source: quote.source,
          fetchedAt: new Date(),
        },
        update: {
          exchange: quote.exchange ?? null,
          currency: quote.currency,
          close: quote.close,
          fetchedAt: new Date(),
        },
      });
      result.updated += 1;
    } catch (error) {
      result.errors.push({
        symbol,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  result.skipped = result.requested - result.updated - result.errors.length;
  return result;
}

export async function getLatestSnapshotsForSymbols(
  prisma: PrismaLike,
  rawSymbols: string[],
) {
  const symbols = [...new Set(rawSymbols.map(normalizeSymbol).filter(Boolean))];
  const rows = await prisma.marketPriceSnapshot
    .findMany({
      where: { symbol: { in: symbols } },
      orderBy: [{ symbol: "asc" }, { priceDate: "desc" }, { fetchedAt: "desc" }],
    })
    .catch((error: unknown) => {
      // DB can be temporarily behind the app version (e.g., migration not yet applied).
      // In that case, degrade gracefully and let callers treat data as missing.
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code?: string }).code === "P2021"
      ) {
        return [];
      }
      throw error;
    });

  const latestBySymbol = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!latestBySymbol.has(row.symbol)) {
      latestBySymbol.set(row.symbol, row);
    }
  }
  return latestBySymbol;
}

