export type EodBar = {
  date: Date;
  close: number;
};

export type FetchEodOptions = {
  outputsize?: number;
  apiKey?: string;
  fetchFn?: typeof fetch;
  baseUrl?: string;
};

type CacheEntry = { bars: EodBar[]; fetchedAtMs: number };

const cache = new Map<string, CacheEntry>();
const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000;
const DEFAULT_BASE_URL = "https://api.twelvedata.com";

function cacheKey(providerSymbol: string, outputsize: number): string {
  return `${providerSymbol}:${outputsize}`;
}

function parseDateOnly(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  if (y == null || m == null || d == null || !Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    throw new Error(`Invalid date: ${value}`);
  }
  return new Date(Date.UTC(y, m - 1, d));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function clearMarketDataCache(): void {
  cache.clear();
}

export async function fetchEodTimeSeries(
  providerSymbol: string,
  opts?: FetchEodOptions,
): Promise<EodBar[]> {
  const outputsize = opts?.outputsize ?? 90;
  const key = cacheKey(providerSymbol, outputsize);
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.fetchedAtMs < DEFAULT_TTL_MS) {
    return hit.bars;
  }

  const apiKey = opts?.apiKey ?? process.env.MARKET_DATA_API_KEY;
  if (!apiKey) {
    throw new Error("MARKET_DATA_API_KEY is not configured");
  }

  const fetchFn = opts?.fetchFn ?? globalThis.fetch;
  if (!fetchFn) {
    throw new Error("Global fetch() is not available");
  }

  const baseUrl = opts?.baseUrl ?? DEFAULT_BASE_URL;
  const url = new URL(`${baseUrl}/time_series`);
  url.searchParams.set("symbol", providerSymbol);
  url.searchParams.set("interval", "1day");
  url.searchParams.set("outputsize", String(outputsize));
  url.searchParams.set("apikey", apiKey);

  const res = await fetchFn(url.toString(), { headers: { Accept: "application/json" } });

  const body = (await res.json()) as {
    status?: string;
    code?: number;
    message?: string;
    values?: Array<{ datetime?: string; close?: string }>;
  };

  if (!res.ok || body.status === "error" || body.code) {
    const detail = body.message ?? `HTTP ${res.status}`;
    throw new Error(`Market data request failed for ${providerSymbol}: ${detail}`);
  }

  const values = body.values ?? [];
  const bars: EodBar[] = [];
  for (const row of values) {
    const dt = row.datetime;
    const close = row.close != null ? Number(row.close) : NaN;
    if (!dt || !Number.isFinite(close) || close <= 0) continue;
    bars.push({ date: parseDateOnly(dt), close });
  }

  bars.sort((a, b) => a.date.getTime() - b.date.getTime());
  cache.set(key, { bars, fetchedAtMs: now });
  return bars;
}

export async function fetchEodBatch(
  providerSymbols: string[],
  opts?: FetchEodOptions & { delayMs?: number },
): Promise<Map<string, EodBar[]>> {
  const result = new Map<string, EodBar[]>();
  const delayMs = opts?.delayMs ?? 0;
  const unique = [...new Set(providerSymbols)];

  for (let i = 0; i < unique.length; i++) {
    const symbol = unique[i]!;
    if (i > 0 && delayMs > 0) {
      await sleep(delayMs);
    }
    const bars = await fetchEodTimeSeries(symbol, opts);
    result.set(symbol, bars);
  }

  return result;
}
