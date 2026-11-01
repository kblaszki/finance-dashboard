import { Prisma, type PrismaClient } from "@prisma/client";
import { formatYmdUtc, utcDateFromYmd } from "./fx";
import {
  defaultSyncRange,
  syncFxRates,
  upsertFxRates,
} from "./fxRates";
import type { NbpFetch } from "./nbpClient";
import { DEMO_LEDGER_MONTHS } from "./seedDemoPortfolio";
import { listMonthsEndingAt } from "./cashflowStats";
import { parseMonthParam } from "./categoryBreakdown";

type Db = PrismaClient | Prisma.TransactionClient;

/** Days of NBP history so net-worth history (24m) and KPIs convert offline after seed. */
export const DEMO_FX_SYNC_DAYS = DEMO_LEDGER_MONTHS * 31 + 40;

export type SeedDemoFxRatesResult = {
  source: "nbp" | "fallback";
  from: string;
  to: string;
  upserted: number;
  warning: string | null;
};

export type SeedDemoFxRatesOptions = {
  now?: Date;
  /** Injected for tests / offline. When set, NBP path uses it. */
  fetchImpl?: NbpFetch;
  /** Force monthly fixture (skip NBP). */
  forceFallback?: boolean;
};

/**
 * Rough mid levels for offline demo (PLN per 1 foreign). Not market-accurate.
 * One row per month-end (and today) so getMidOnOrBefore always finds a rate.
 */
export function buildDemoFxFallbackRows(
  now: Date = new Date(),
  monthCount: number = DEMO_LEDGER_MONTHS,
): Array<{ currency: "EUR" | "USD"; rateDate: Date; mid: Prisma.Decimal }> {
  const anchor = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const months = listMonthsEndingAt(anchor, monthCount);
  const dates = new Set<string>();
  for (const month of months) {
    const { end } = parseMonthParam(month);
    // Last calendar day of month = day before exclusive end
    const last = new Date(end.getTime());
    last.setUTCDate(last.getUTCDate() - 1);
    dates.add(formatYmdUtc(last));
  }
  dates.add(
    formatYmdUtc(
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
    ),
  );

  const rows: Array<{
    currency: "EUR" | "USD";
    rateDate: Date;
    mid: Prisma.Decimal;
  }> = [];
  for (const ymd of [...dates].sort()) {
    rows.push({
      currency: "EUR",
      rateDate: utcDateFromYmd(ymd),
      mid: new Prisma.Decimal("4.30"),
    });
    rows.push({
      currency: "USD",
      rateDate: utcDateFromYmd(ymd),
      mid: new Prisma.Decimal("4.00"),
    });
  }
  return rows;
}

/**
 * Ensure FxRateDaily can convert EUR/USD for the demo portfolio window.
 * Prefers live NBP sync; on failure (or forceFallback) upserts monthly fixture mids.
 */
export async function seedDemoFxRates(
  db: Db,
  options: SeedDemoFxRatesOptions = {},
): Promise<SeedDemoFxRatesResult> {
  const now = options.now ?? new Date();
  const range = defaultSyncRange(DEMO_FX_SYNC_DAYS);

  if (!options.forceFallback) {
    try {
      const synced = await syncFxRates(db, {
        fromYmd: range.fromYmd,
        toYmd: range.toYmd,
        fetchImpl: options.fetchImpl,
      });
      return {
        source: "nbp",
        from: synced.from,
        to: synced.to,
        upserted: synced.upserted,
        warning: null,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      const upserted = await upsertFxRates(
        db,
        buildDemoFxFallbackRows(now, DEMO_LEDGER_MONTHS),
      );
      return {
        source: "fallback",
        from: range.fromYmd,
        to: range.toYmd,
        upserted,
        warning: `NBP FX sync failed (${message}); seeded monthly EUR/USD fixture mids`,
      };
    }
  }

  const upserted = await upsertFxRates(
    db,
    buildDemoFxFallbackRows(now, DEMO_LEDGER_MONTHS),
  );
  return {
    source: "fallback",
    from: range.fromYmd,
    to: range.toYmd,
    upserted,
    warning: null,
  };
}
