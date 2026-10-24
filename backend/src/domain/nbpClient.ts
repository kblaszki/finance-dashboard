import { Prisma } from "@prisma/client";
import {
  FX_NBP_CURRENCIES,
  formatYmdUtc,
  type FxNbpCurrency,
  utcDateFromYmd,
} from "./fx";

export const DEFAULT_NBP_API_BASE = "https://api.nbp.pl/api";

/** NBP allows at most 367 days per rates request. */
export const NBP_MAX_RANGE_DAYS = 367;

export type NbpRateRow = {
  currency: FxNbpCurrency;
  rateDate: Date;
  mid: Prisma.Decimal;
};

export type NbpFetch = (url: string) => Promise<Response>;

type NbpRatesPayload = {
  code?: string;
  rates?: Array<{ effectiveDate?: string; mid?: number }>;
};

function nbpBase(): string {
  const raw = String(process.env.NBP_API_BASE ?? DEFAULT_NBP_API_BASE).trim();
  return raw.replace(/\/+$/, "") || DEFAULT_NBP_API_BASE;
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function* dateChunks(from: Date, to: Date, maxDays: number): Generator<[Date, Date]> {
  let start = from;
  while (start <= to) {
    const end = addUtcDays(start, maxDays - 1);
    const chunkEnd = end < to ? end : to;
    yield [start, chunkEnd];
    start = addUtcDays(chunkEnd, 1);
  }
}

/**
 * Fetch NBP table A mid rates for one currency over [fromYmd, toYmd] inclusive.
 * Empty / 404 ranges return [].
 */
export async function fetchNbpRatesForCurrency(
  currency: FxNbpCurrency,
  fromYmd: string,
  toYmd: string,
  fetchImpl: NbpFetch = fetch,
): Promise<NbpRateRow[]> {
  const from = utcDateFromYmd(fromYmd);
  const to = utcDateFromYmd(toYmd);
  if (from > to) {
    throw new Error("from date must be on or before to date");
  }

  const out: NbpRateRow[] = [];
  const base = nbpBase();

  for (const [chunkStart, chunkEnd] of dateChunks(from, to, NBP_MAX_RANGE_DAYS)) {
    const start = formatYmdUtc(chunkStart);
    const end = formatYmdUtc(chunkEnd);
    const url = `${base}/exchangerates/rates/A/${currency}/${start}/${end}/?format=json`;
    const res = await fetchImpl(url);
    if (res.status === 404) continue;
    if (!res.ok) {
      throw new Error(`NBP request failed (${res.status}) for ${currency} ${start}..${end}`);
    }
    const body = (await res.json()) as NbpRatesPayload;
    for (const rate of body.rates ?? []) {
      if (!rate.effectiveDate || rate.mid == null || !Number.isFinite(rate.mid)) {
        continue;
      }
      out.push({
        currency,
        rateDate: utcDateFromYmd(rate.effectiveDate),
        mid: new Prisma.Decimal(rate.mid.toString()),
      });
    }
  }

  return out;
}

/** Fetch EUR + USD for the inclusive date range. */
export async function fetchNbpRates(
  fromYmd: string,
  toYmd: string,
  fetchImpl: NbpFetch = fetch,
): Promise<NbpRateRow[]> {
  const rows: NbpRateRow[] = [];
  for (const code of FX_NBP_CURRENCIES) {
    rows.push(...(await fetchNbpRatesForCurrency(code, fromYmd, toYmd, fetchImpl)));
  }
  return rows;
}
