import { badRequest } from "../lib/errors";

export const DEFAULT_OANOR_GPW_API_BASE = "https://api.oanor.com/gpw-api";

/** Free tier: 2 requests per second (OpenAPI x-oanor-pricing). */
export const OANOR_GPW_RPS_LIMIT = 2;

/** Max tickers per GET /v1/quote. */
export const OANOR_GPW_QUOTE_BATCH_SIZE = 20;

export type OanorFetch = (
  url: string,
  init?: RequestInit,
) => Promise<Response>;

export type OanorGpwQuote = {
  symbol: string;
  close: number;
  /** YYYY-MM-DD from meta.timestamp (or today UTC). */
  asOfYmd: string;
  currency: string | null;
};

function apiBase(): string {
  const raw = String(
    process.env.OANOR_GPW_API_BASE ?? DEFAULT_OANOR_GPW_API_BASE,
  ).trim();
  return raw.replace(/\/+$/, "") || DEFAULT_OANOR_GPW_API_BASE;
}

export function getOanorApiKey(): string {
  const key = String(process.env.OANOR_API_KEY ?? "").trim();
  if (!key) {
    throw badRequest("OANOR_API_KEY is not configured");
  }
  return key;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function ymdFromDatetime(raw: string): string | null {
  const s = raw.trim();
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m?.[1] ?? null;
}

function todayUtcYmd(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Space requests so at most `rps` finish per second (gap ≈ 1000/rps ms).
 */
export function createRpsPacer(
  rps: number = OANOR_GPW_RPS_LIMIT,
): () => Promise<void> {
  const minGapMs = Math.max(Math.ceil(1000 / Math.max(rps, 1)), 1);
  let lastAt = 0;
  return async () => {
    const now = Date.now();
    const wait = lastAt + minGapMs - now;
    if (wait > 0) {
      await new Promise((r) => setTimeout(r, wait));
    }
    lastAt = Date.now();
  };
}

function normalizeCodes(codes: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of codes) {
    const code = String(raw ?? "").trim().toUpperCase();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}

/**
 * Live quotes via GET /v1/quote?codes=… (up to 20 tickers per request).
 * Missing tickers are omitted from the result (caller treats as soft-fail).
 */
export async function fetchOanorGpwQuotes(
  codes: string[],
  fetchImpl: OanorFetch = fetch,
  apiKey?: string,
  now: Date = new Date(),
): Promise<OanorGpwQuote[]> {
  const list = normalizeCodes(codes);
  if (list.length === 0) throw badRequest("codes required");
  if (list.length > OANOR_GPW_QUOTE_BATCH_SIZE) {
    throw badRequest(
      `codes batch max is ${OANOR_GPW_QUOTE_BATCH_SIZE} tickers`,
    );
  }
  const key = apiKey ?? getOanorApiKey();
  const url = new URL(`${apiBase()}/v1/quote`);
  url.searchParams.set("codes", list.join(","));

  const res = await fetchImpl(url.toString(), {
    headers: { "x-oanor-key": key },
  });
  if (res.status === 401 || res.status === 402) {
    throw badRequest("Oanor GPW API key missing, invalid, or subscription inactive");
  }
  if (res.status === 429) {
    throw badRequest("Oanor GPW rate limit or monthly quota exceeded; try again later");
  }
  if (!res.ok) {
    throw new Error(`Oanor GPW request failed (${res.status})`);
  }

  const payload = await res.json();
  const root = asRecord(payload);
  if (!root) throw new Error("Oanor GPW quote: invalid payload");
  if (root.success === false || (root.status && root.status !== "ok")) {
    throw badRequest(String(root.message ?? "Oanor GPW quote error"));
  }

  const data = asRecord(root.data) ?? root;
  const meta = asRecord(root.meta);
  const asOfFallback =
    ymdFromDatetime(String(meta?.timestamp ?? "")) ?? todayUtcYmd(now);

  const quotesRaw = Array.isArray(data.quotes) ? data.quotes : [];
  const out: OanorGpwQuote[] = [];
  for (const raw of quotesRaw) {
    const row = asRecord(raw);
    if (!row) continue;
    const symbol = String(row.ticker ?? row.symbol ?? "")
      .trim()
      .toUpperCase();
    if (!symbol) continue;
    const close = Number(row.price ?? row.close);
    if (!Number.isFinite(close) || close <= 0) continue;
    const currencyRaw = String(row.currency ?? "").trim().toUpperCase();
    out.push({
      symbol,
      close,
      asOfYmd: asOfFallback,
      currency: currencyRaw || null,
    });
  }
  return out;
}
