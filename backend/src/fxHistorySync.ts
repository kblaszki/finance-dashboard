import type { Prisma, PrismaClient } from "@prisma/client";
import { MVP_MARKET_DATA_EPOCH, defaultBackfillDays } from "./marketDataEpoch";
import { normalizeCurrency } from "./fx";

type DbClient = PrismaClient | Prisma.TransactionClient;

export const FX_HISTORY_SOURCE = "nbp";

const NBP_FOREIGN_CODES = ["USD", "EUR"] as const;

export type SyncFxRatesResult = {
  upserted: number;
  skipped: number;
  errors: string[];
};

function parseDateOnly(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  if (y == null || m == null || d == null || !Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    throw new Error(`Invalid date: ${value}`);
  }
  return new Date(Date.UTC(y, m - 1, d));
}

function formatNbpDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function fetchNbpRatesRange(
  code: string,
  startDate: Date,
  endDate: Date,
  fetchFn?: typeof fetch,
): Promise<Array<{ effectiveDate: string; mid: number }>> {
  const fetchImpl = fetchFn ?? globalThis.fetch;
  if (!fetchImpl) {
    throw new Error("Global fetch() is not available");
  }

  const url = `https://api.nbp.pl/api/exchangerates/rates/A/${code}/${formatNbpDate(startDate)}/${formatNbpDate(endDate)}/?format=json`;
  const res = await fetchImpl(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`NBP FX request failed (status ${res.status})`);
  }

  const body = (await res.json()) as {
    rates?: Array<{ effectiveDate?: string; mid?: number }>;
  };
  const rows: Array<{ effectiveDate: string; mid: number }> = [];
  for (const row of body.rates ?? []) {
    const effectiveDate = row.effectiveDate;
    const mid = row.mid != null ? Number(row.mid) : NaN;
    if (!effectiveDate || !Number.isFinite(mid) || mid <= 0) continue;
    rows.push({ effectiveDate, mid });
  }
  return rows;
}

export async function syncFxRatesSinceEpoch(
  prisma: DbClient,
  opts?: { fetchFn?: typeof fetch; endDate?: Date },
): Promise<SyncFxRatesResult> {
  const result: SyncFxRatesResult = { upserted: 0, skipped: 0, errors: [] };
  const endDate = opts?.endDate ?? new Date();
  const startDate = MVP_MARKET_DATA_EPOCH;

  for (const code of NBP_FOREIGN_CODES) {
    try {
      const rates = await fetchNbpRatesRange(code, startDate, endDate, opts?.fetchFn);
      if (!rates.length) {
        result.skipped += 1;
        continue;
      }

      for (const row of rates) {
        const rateDate = parseDateOnly(row.effectiveDate);
        const baseCurrency = normalizeCurrency(code);
        await prisma.fxRateDaily.upsert({
          where: {
            rateDate_baseCurrency_quoteCurrency_source: {
              rateDate,
              baseCurrency,
              quoteCurrency: "PLN",
              source: FX_HISTORY_SOURCE,
            },
          },
          create: {
            rateDate,
            baseCurrency,
            quoteCurrency: "PLN",
            rate: row.mid,
            source: FX_HISTORY_SOURCE,
          },
          update: { rate: row.mid },
        });
        result.upserted += 1;
      }
    } catch (e: unknown) {
      result.errors.push(
        `${code}: ${e instanceof Error ? e.message : "FX sync failed"}`,
      );
    }
  }

  return result;
}

export async function getFxRateOnDate(
  prisma: DbClient,
  baseCurrency: string,
  quoteCurrency: string,
  rateDate: Date,
): Promise<number | null> {
  const base = normalizeCurrency(baseCurrency);
  const quote = normalizeCurrency(quoteCurrency);
  if (base === quote) return 1;

  const day = parseDateOnly(rateDate.toISOString());

  if (quote === "PLN") {
    const row = await prisma.fxRateDaily.findUnique({
      where: {
        rateDate_baseCurrency_quoteCurrency_source: {
          rateDate: day,
          baseCurrency: base,
          quoteCurrency: "PLN",
          source: FX_HISTORY_SOURCE,
        },
      },
    });
    return row ? Number(row.rate) : null;
  }

  if (base === "PLN") {
    const inverse = await getFxRateOnDate(prisma, quote, "PLN", day);
    return inverse != null && inverse > 0 ? 1 / inverse : null;
  }

  const basePln = await getFxRateOnDate(prisma, base, "PLN", day);
  const quotePln = await getFxRateOnDate(prisma, quote, "PLN", day);
  if (basePln == null || quotePln == null || quotePln <= 0) return null;
  return basePln / quotePln;
}

export function defaultFxBackfillDays(): number {
  return defaultBackfillDays();
}
