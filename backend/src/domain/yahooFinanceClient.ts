import { badRequest } from "../lib/errors";

export const DEFAULT_YAHOO_CHART_BASE =
  "https://query1.finance.yahoo.com/v8/finance/chart";

export type YahooFetch = (
  url: string,
  init?: RequestInit,
) => Promise<Response>;

export type YahooBar = {
  asOfYmd: string;
  close: number;
};

function chartBase(): string {
  const raw = String(
    process.env.YAHOO_CHART_API_BASE ?? DEFAULT_YAHOO_CHART_BASE,
  ).trim();
  return raw.replace(/\/$/, "") || DEFAULT_YAHOO_CHART_BASE;
}

function ymdFromUnixUtc(sec: number): string | null {
  if (!Number.isFinite(sec)) return null;
  const d = new Date(sec * 1000);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Parse Yahoo v8 chart payload into daily close bars (adjclose preferred).
 */
export function parseYahooChartPayload(payload: unknown): YahooBar[] {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  const chart = root?.chart && typeof root.chart === "object"
    ? (root.chart as Record<string, unknown>)
    : null;
  if (chart?.error) {
    const err = chart.error as Record<string, unknown>;
    throw badRequest(
      String(err.description ?? err.code ?? "Yahoo chart error"),
    );
  }
  const result = Array.isArray(chart?.result) ? chart!.result[0] : null;
  if (!result || typeof result !== "object") return [];
  const row = result as Record<string, unknown>;
  const timestamps = Array.isArray(row.timestamp)
    ? (row.timestamp as unknown[])
    : [];
  const indicators =
    row.indicators && typeof row.indicators === "object"
      ? (row.indicators as Record<string, unknown>)
      : {};
  const quoteArr = Array.isArray(indicators.quote) ? indicators.quote : [];
  const adjArr = Array.isArray(indicators.adjclose) ? indicators.adjclose : [];
  const quote0 =
    quoteArr[0] && typeof quoteArr[0] === "object"
      ? (quoteArr[0] as Record<string, unknown>)
      : {};
  const adj0 =
    adjArr[0] && typeof adjArr[0] === "object"
      ? (adjArr[0] as Record<string, unknown>)
      : {};
  const closes = Array.isArray(adj0.adjclose)
    ? (adj0.adjclose as unknown[])
    : Array.isArray(quote0.close)
      ? (quote0.close as unknown[])
      : [];

  const out: YahooBar[] = [];
  const n = Math.min(timestamps.length, closes.length);
  for (let i = 0; i < n; i += 1) {
    const asOfYmd = ymdFromUnixUtc(Number(timestamps[i]));
    const close = Number(closes[i]);
    if (!asOfYmd || !Number.isFinite(close) || close <= 0) continue;
    out.push({ asOfYmd, close });
  }
  return out;
}

/**
 * Daily history via Yahoo chart API (`interval=1d`, default `range=1y`).
 * Unofficial endpoint — hobby / private use only; no API key.
 */
export async function fetchYahooDailyHistory(
  yahooSymbol: string,
  options: {
    range?: string;
    fetchImpl?: YahooFetch;
  } = {},
): Promise<YahooBar[]> {
  const symbol = String(yahooSymbol ?? "").trim();
  if (!symbol) throw badRequest("yahooSymbol required");
  const fetchImpl = options.fetchImpl ?? fetch;
  const range = options.range ?? "1y";
  const url = new URL(
    `${chartBase()}/${encodeURIComponent(symbol)}`,
  );
  url.searchParams.set("interval", "1d");
  url.searchParams.set("range", range);

  const res = await fetchImpl(url.toString(), {
    headers: {
      "User-Agent": "finance-dashboard/1.0 (private; Yahoo chart history)",
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`Yahoo chart request failed (${res.status})`);
  }
  const payload: unknown = await res.json();
  return parseYahooChartPayload(payload);
}
