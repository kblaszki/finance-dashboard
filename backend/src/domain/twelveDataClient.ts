import { badRequest } from "../lib/errors";

export const DEFAULT_TWELVE_DATA_API_BASE = "https://api.twelvedata.com";

/** Free Basic plan: 8 API credits per minute. */
export const TWELVE_DATA_CREDITS_PER_MINUTE = 8;

export type TwelveDataFetch = (url: string) => Promise<Response>;

export type TwelveDataCatalogRow = {
  symbol: string;
  name: string;
  exchange: string;
  micCode: string | null;
  country: string | null;
  currency: string;
};

export type TwelveDataEodQuote = {
  symbol: string;
  close: number;
  /** YYYY-MM-DD from provider (or datetime date part). */
  asOfYmd: string;
  currency: string | null;
};

function apiBase(): string {
  const raw = String(
    process.env.TWELVE_DATA_API_BASE ?? DEFAULT_TWELVE_DATA_API_BASE,
  ).trim();
  return raw.replace(/\/+$/, "") || DEFAULT_TWELVE_DATA_API_BASE;
}

export function getTwelveDataApiKey(): string {
  const key = String(process.env.TWELVE_DATA_API_KEY ?? "").trim();
  if (!key) {
    throw badRequest("TWELVE_DATA_API_KEY is not configured");
  }
  return key;
}

function buildUrl(
  path: string,
  params: Record<string, string | undefined>,
  apiKey: string,
): string {
  const url = new URL(`${apiBase()}${path.startsWith("/") ? path : `/${path}`}`);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") url.searchParams.set(k, v);
  }
  url.searchParams.set("apikey", apiKey);
  return url.toString();
}

async function readJson(
  url: string,
  fetchImpl: TwelveDataFetch,
): Promise<unknown> {
  const res = await fetchImpl(url);
  if (res.status === 429) {
    throw badRequest("Twelve Data rate limit exceeded; try again shortly");
  }
  if (!res.ok) {
    throw new Error(`Twelve Data request failed (${res.status})`);
  }
  return res.json();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function mapCatalogItem(raw: unknown): TwelveDataCatalogRow | null {
  const row = asRecord(raw);
  if (!row) return null;
  const symbol = String(row.symbol ?? "").trim();
  if (!symbol) return null;
  const name = String(row.name ?? symbol).trim() || symbol;
  const exchange = String(row.exchange ?? "").trim();
  const micCode = String(row.mic_code ?? "").trim() || null;
  const country = String(row.country ?? "").trim() || null;
  const currency = String(row.currency ?? "USD").trim().toUpperCase() || "USD";
  return { symbol, name, exchange, micCode, country, currency };
}

function extractCatalogData(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const obj = asRecord(payload);
  if (!obj) return [];
  if (obj.status === "error") {
    const msg = String(obj.message ?? "Twelve Data catalog error");
    throw new Error(msg);
  }
  if (Array.isArray(obj.data)) return obj.data;
  return [];
}

/** GET /stocks — full stock catalog (1 credit). */
export async function fetchTwelveDataStocks(
  fetchImpl: TwelveDataFetch = fetch,
  apiKey?: string,
): Promise<TwelveDataCatalogRow[]> {
  const key = apiKey ?? getTwelveDataApiKey();
  const url = buildUrl("/stocks", {}, key);
  const payload = await readJson(url, fetchImpl);
  return extractCatalogData(payload)
    .map(mapCatalogItem)
    .filter((row): row is TwelveDataCatalogRow => row != null);
}

/** GET /etfs — full ETF catalog (1 credit). */
export async function fetchTwelveDataEtfs(
  fetchImpl: TwelveDataFetch = fetch,
  apiKey?: string,
): Promise<TwelveDataCatalogRow[]> {
  const key = apiKey ?? getTwelveDataApiKey();
  const url = buildUrl("/etfs", {}, key);
  const payload = await readJson(url, fetchImpl);
  return extractCatalogData(payload)
    .map(mapCatalogItem)
    .filter((row): row is TwelveDataCatalogRow => row != null);
}

function ymdFromDatetime(raw: string): string | null {
  const s = raw.trim();
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m?.[1] ?? null;
}

/**
 * Latest EOD close via GET /quote?interval=1day (1 credit).
 * Falls back to parsing close + datetime from the quote payload.
 */
export async function fetchTwelveDataEodQuote(
  providerSymbol: string,
  fetchImpl: TwelveDataFetch = fetch,
  apiKey?: string,
): Promise<TwelveDataEodQuote> {
  const symbol = String(providerSymbol ?? "").trim();
  if (!symbol) throw badRequest("symbol required");
  const key = apiKey ?? getTwelveDataApiKey();

  const url = buildUrl(
    "/quote",
    { symbol, interval: "1day" },
    key,
  );
  const payload = await readJson(url, fetchImpl);
  const obj = asRecord(payload);
  if (!obj) throw new Error("Twelve Data quote: invalid payload");
  if (obj.status === "error") {
    throw badRequest(String(obj.message ?? `No quote for ${symbol}`));
  }

  const closeRaw = obj.close ?? obj.previous_close;
  const close = Number(closeRaw);
  if (!Number.isFinite(close) || close <= 0) {
    throw badRequest(`Twelve Data returned no usable close for ${symbol}`);
  }

  const asOfYmd =
    ymdFromDatetime(String(obj.datetime ?? obj.timestamp ?? "")) ??
    ymdFromDatetime(String(obj.date ?? ""));
  if (!asOfYmd) {
    throw badRequest(`Twelve Data quote missing date for ${symbol}`);
  }

  const currencyRaw = String(obj.currency ?? "").trim().toUpperCase();
  return {
    symbol: String(obj.symbol ?? symbol).trim() || symbol,
    close,
    asOfYmd,
    currency: currencyRaw || null,
  };
}

/**
 * Simple credit pacing: await so at most `creditsPerMinute` calls finish per rolling minute.
 * Call before each outbound Twelve Data request when looping.
 */
export function createCreditPacer(
  creditsPerMinute: number = TWELVE_DATA_CREDITS_PER_MINUTE,
): () => Promise<void> {
  const timestamps: number[] = [];
  return async () => {
    const now = Date.now();
    while (timestamps.length > 0 && now - timestamps[0]! >= 60_000) {
      timestamps.shift();
    }
    if (timestamps.length >= creditsPerMinute) {
      const waitMs = 60_000 - (now - timestamps[0]!) + 25;
      await new Promise((r) => setTimeout(r, Math.max(waitMs, 25)));
    }
    timestamps.push(Date.now());
  };
}
