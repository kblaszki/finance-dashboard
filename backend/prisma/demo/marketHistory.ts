import type { PrismaClient } from "@prisma/client";
import type { EodBar } from "../../src/marketData";
import { fetchEodTimeSeries } from "../../src/marketData";
import { mapInstrumentToProviderSymbol } from "../../src/marketDataSymbols";
import { upsertInstrumentEodBars } from "../../src/marketDataSync";
import {
  type DemoInstrumentSpec,
  SEED_API_DELAY_MS,
  SEED_MARKET_OUTPUTSIZE,
} from "./seedConfig";

export function utcDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Latest EOD close on or before `date` (nearest prior session). */
export function closeOnDate(bars: EodBar[], date: Date): number | null {
  if (!bars.length) return null;
  const target = utcDateOnly(date).getTime();
  let best: EodBar | null = null;
  for (const bar of bars) {
    const t = utcDateOnly(bar.date).getTime();
    if (t > target) continue;
    if (!best || t > utcDateOnly(best.date).getTime()) {
      best = bar;
    }
  }
  return best ? best.close : null;
}

export type MarketHistoryCache = Map<string, EodBar[]>;

const RATE_LIMIT_WAIT_MS = 65_000;
const MAX_FETCH_ATTEMPTS = 4;

async function fetchWithRateLimitRetry(
  providerSymbol: string,
  opts: { outputsize: number; apiKey?: string },
): Promise<EodBar[]> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt++) {
    try {
      return await fetchEodTimeSeries(providerSymbol, opts);
    } catch (e: unknown) {
      lastError = e instanceof Error ? e : new Error(String(e));
      const msg = lastError.message;
      const isRateLimit = /run out of API credits/i.test(msg);
      const isTransient = /terminated|socket|ECONNRESET|ETIMEDOUT|fetch failed/i.test(msg);
      if ((!isRateLimit && !isTransient) || attempt === MAX_FETCH_ATTEMPTS) {
        throw lastError;
      }
      const waitMs = isRateLimit ? RATE_LIMIT_WAIT_MS : 5_000 * attempt;
      // eslint-disable-next-line no-console
      console.warn(
        `Retry ${providerSymbol} in ${waitMs / 1000}s (${msg.slice(0, 80)})…`,
      );
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw lastError ?? new Error(`Failed to fetch ${providerSymbol}`);
}

export function providerSymbolForInstrument(spec: DemoInstrumentSpec): string | null {
  if (spec.providerSymbol?.trim()) {
    return spec.providerSymbol.trim().toUpperCase();
  }
  return mapInstrumentToProviderSymbol({
    symbol: spec.symbol,
    exchange: spec.exchange,
    instrumentType: spec.instrumentType,
    currency: spec.currency,
  });
}

export async function fetchDemoMarketHistory(
  providerSymbols: string[],
  opts?: { apiKey?: string; outputsize?: number; delayMs?: number },
): Promise<MarketHistoryCache> {
  const cache: MarketHistoryCache = new Map();
  const outputsize = opts?.outputsize ?? SEED_MARKET_OUTPUTSIZE;
  const delayMs = opts?.delayMs ?? SEED_API_DELAY_MS;
  const unique = [...new Set(providerSymbols)];

  for (const providerSymbol of unique) {
    const bars = await fetchWithRateLimitRetry(providerSymbol, {
      outputsize,
      ...(opts?.apiKey ? { apiKey: opts.apiKey } : {}),
    });
    cache.set(providerSymbol, bars);
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return cache;
}

export async function persistInstrumentEodBars(
  prisma: PrismaClient,
  instrumentId: number,
  currency: string,
  bars: EodBar[],
): Promise<number> {
  return upsertInstrumentEodBars(prisma, instrumentId, currency, bars);
}
