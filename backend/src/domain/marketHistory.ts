import type { PrismaClient } from "@prisma/client";
import { getMarketLiveApi } from "./appConfig";
import { isGpwListed } from "./instruments";
import {
  countDistinctClosesInWindow,
  historyWindowFromMonths,
  upsertInstrumentClose,
  VALUATION_SOURCE_STOOQ,
  VALUATION_SOURCE_TWELVE_DATA,
} from "./instrumentValuations";
import {
  loadUniverseSeedRows,
  marketUniverseDir,
  universeByProviderSymbol,
} from "./marketUniverse";
import {
  fetchStooqDailyHistory,
  type StooqFetch,
} from "./stooqClient";
import {
  createCreditPacer,
  fetchTwelveDataTimeSeries,
  type TwelveDataFetch,
} from "./twelveDataClient";
import { syncYahooHistory } from "./yahooHistory";
import type { YahooFetch } from "./yahooFinanceClient";

/** Distinct closes below this in ~260 calendar days → soft backfill on GET. */
export const HISTORY_SPARSE_THRESHOLD = 20;

export type SyncHistoryResult = {
  attempted: number;
  updatedInstruments: number;
  barsUpserted: number;
  skipped: number;
  failed: number;
  errors: Array<{ instrumentId: number; symbol: string; message: string }>;
};

export type SyncHistoryOptions = {
  instrumentId?: number;
  force?: boolean;
  /** Trading days to request from TD (~1y). Legacy TD path only. */
  outputsize?: number;
  fetchImpl?: TwelveDataFetch & StooqFetch & YahooFetch;
  apiKey?: string;
  universeDir?: string;
  /** Delay between provider calls (ms). */
  stooqDelayMs?: number;
};

export type EnsureInstrumentHistoryResult = {
  backfilled: boolean;
  backfillMessage?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function countRecentBars(
  prisma: PrismaClient,
  instrumentId: number,
  source: string,
): Promise<number> {
  return prisma.instrumentValuation.count({
    where: { instrumentId, source },
  });
}

/**
 * Backfill ~1y daily closes for allowlisted instruments.
 * Default / `historySource: yahoo` → Yahoo chart. Legacy `stooq` / `twelve_data`
 * seed hints still supported if present in custom universe files.
 */
export async function syncAllowlistHistory(
  prisma: PrismaClient,
  options: SyncHistoryOptions = {},
): Promise<SyncHistoryResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const force = options.force === true;
  const outputsize = options.outputsize ?? 260;
  const stooqDelayMs = options.stooqDelayMs ?? 350;
  const { rows: seedRows } = loadUniverseSeedRows(
    options.universeDir ?? marketUniverseDir(),
  );
  const seedMap = universeByProviderSymbol(seedRows);

  // Explicit instrumentId: sync that row even if not allowlisted (HTTP soft backfill).
  const instruments = await prisma.instrument.findMany({
    where:
      options.instrumentId != null
        ? { id: options.instrumentId }
        : { allowlisted: true },
    orderBy: { symbol: "asc" },
  });

  const usesLegacyProvider = instruments.some((instrument) => {
    const seed = seedMap.get(instrument.providerSymbol.toUpperCase());
    const src = String(seed?.historySource ?? "yahoo").toLowerCase();
    return src === "stooq" || src === "twelve_data";
  });

  if (!usesLegacyProvider) {
    return syncYahooHistory(prisma, {
      force,
      delayMs: stooqDelayMs,
      range: "1y",
      ...(options.instrumentId != null
        ? { instrumentId: options.instrumentId }
        : {}),
      ...(options.fetchImpl != null ? { fetchImpl: options.fetchImpl } : {}),
    });
  }

  const pace = createCreditPacer();
  let updatedInstruments = 0;
  let barsUpserted = 0;
  let skipped = 0;
  let failed = 0;
  const errors: SyncHistoryResult["errors"] = [];

  for (const instrument of instruments) {
    const seed = seedMap.get(instrument.providerSymbol.toUpperCase());
    const historySource = String(seed?.historySource ?? "yahoo").toLowerCase();
    const useStooq =
      historySource === "stooq" ||
      (historySource !== "yahoo" &&
        historySource !== "twelve_data" &&
        isGpwListed(instrument) &&
        Boolean(seed?.stooqSymbol));
    const useYahoo = historySource === "yahoo" || (!useStooq && historySource !== "twelve_data");

    if (useYahoo) {
      try {
        if (stooqDelayMs > 0) await sleep(stooqDelayMs);
        const yahoo = await syncYahooHistory(prisma, {
          instrumentId: instrument.id,
          force,
          delayMs: 0,
          range: "1y",
          ...(options.fetchImpl != null ? { fetchImpl: options.fetchImpl } : {}),
        });
        updatedInstruments += yahoo.updatedInstruments;
        barsUpserted += yahoo.barsUpserted;
        skipped += yahoo.skipped;
        failed += yahoo.failed;
        errors.push(...yahoo.errors);
      } catch (e: unknown) {
        failed += 1;
        errors.push({
          instrumentId: instrument.id,
          symbol: instrument.symbol,
          message: e instanceof Error ? e.message : String(e),
        });
      }
      continue;
    }

    const source = useStooq
      ? VALUATION_SOURCE_STOOQ
      : VALUATION_SOURCE_TWELVE_DATA;

    if (!force) {
      const existing = await countRecentBars(prisma, instrument.id, source);
      if (existing >= Math.floor(outputsize * 0.8)) {
        skipped += 1;
        continue;
      }
    }

    try {
      let bars: Array<{ asOfYmd: string; close: number }> = [];
      if (useStooq) {
        const stooqSymbol =
          seed?.stooqSymbol ??
          (instrument.assetClass === "INDEX"
            ? `^${instrument.symbol.toLowerCase()}`
            : instrument.symbol.toLowerCase());
        await sleep(stooqDelayMs);
        bars = await fetchStooqDailyHistory(stooqSymbol, fetchImpl);
        bars = bars
          .slice()
          .sort((a, b) => (a.asOfYmd < b.asOfYmd ? 1 : -1))
          .slice(0, outputsize);
      } else {
        await pace();
        bars = await fetchTwelveDataTimeSeries(instrument.providerSymbol, {
          outputsize,
          fetchImpl,
          ...(options.apiKey !== undefined ? { apiKey: options.apiKey } : {}),
        });
      }

      if (bars.length === 0) {
        failed += 1;
        errors.push({
          instrumentId: instrument.id,
          symbol: instrument.symbol,
          message: "No history bars returned",
        });
        continue;
      }

      for (const bar of bars) {
        await upsertInstrumentClose(prisma, {
          instrumentId: instrument.id,
          asOfYmd: bar.asOfYmd,
          close: bar.close,
          source,
        });
        barsUpserted += 1;
      }
      updatedInstruments += 1;
    } catch (e: unknown) {
      failed += 1;
      errors.push({
        instrumentId: instrument.id,
        symbol: instrument.symbol,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return {
    attempted: instruments.length,
    updatedInstruments,
    barsUpserted,
    skipped,
    failed,
    errors,
  };
}

/**
 * Soft backfill ~1y history when the series is sparse. Never throws — callers
 * still return whatever is already in InstrumentValuation.
 * Valuation path is Yahoo-only (TD/Stooq dormant for HTTP).
 */
export async function ensureInstrumentHistory(
  prisma: PrismaClient,
  instrumentId: number,
  options: {
    fetchImpl?: YahooFetch;
    apiKey?: string;
    now?: Date;
    sparseThreshold?: number;
  } = {},
): Promise<EnsureInstrumentHistoryResult> {
  if (!(await getMarketLiveApi(prisma))) {
    return { backfilled: false };
  }

  const now = options.now ?? new Date();
  const threshold = options.sparseThreshold ?? HISTORY_SPARSE_THRESHOLD;
  const window = historyWindowFromMonths(12, now);
  const existing = await countDistinctClosesInWindow(
    prisma,
    instrumentId,
    window,
  );
  if (existing >= threshold) {
    return { backfilled: false };
  }

  const timeoutMs = 12_000;
  try {
    const yahoo = await Promise.race([
      syncYahooHistory(prisma, {
        instrumentId,
        // Never force on HTTP GET — skip when series is already dense enough.
        force: false,
        delayMs: 0,
        range: "1y",
        sparseThreshold: threshold,
        ...(options.fetchImpl != null ? { fetchImpl: options.fetchImpl } : {}),
      }),
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
    if (yahoo == null) {
      return {
        backfilled: false,
        backfillMessage: `Yahoo history backfill timed out after ${timeoutMs}ms`,
      };
    }
    if (yahoo.updatedInstruments > 0 || yahoo.barsUpserted > 0) {
      return { backfilled: true };
    }
    if (yahoo.failed > 0) {
      return {
        backfilled: false,
        backfillMessage:
          yahoo.errors[0]?.message ?? "Yahoo history backfill failed",
      };
    }
  } catch (e: unknown) {
    return {
      backfilled: false,
      backfillMessage: e instanceof Error ? e.message : String(e),
    };
  }

  return { backfilled: false };
}
