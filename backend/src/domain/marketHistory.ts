import type { PrismaClient } from "@prisma/client";
import { isGpwListed } from "./instruments";
import {
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
  /** Trading days to request from TD (~1y). */
  outputsize?: number;
  fetchImpl?: TwelveDataFetch & StooqFetch;
  apiKey?: string;
  universeDir?: string;
  /** Delay between Stooq calls (ms). */
  stooqDelayMs?: number;
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
 * GPW (+ seed stooqSymbol) → Stooq; otherwise Twelve Data time_series.
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

  const instruments = await prisma.instrument.findMany({
    where: {
      allowlisted: true,
      ...(options.instrumentId != null
        ? { id: options.instrumentId }
        : {}),
    },
    orderBy: { symbol: "asc" },
  });

  const pace = createCreditPacer();
  let updatedInstruments = 0;
  let barsUpserted = 0;
  let skipped = 0;
  let failed = 0;
  const errors: SyncHistoryResult["errors"] = [];

  for (const instrument of instruments) {
    const seed = seedMap.get(instrument.providerSymbol.toUpperCase());
    const useStooq =
      seed?.historySource === "stooq" ||
      (isGpwListed(instrument) && Boolean(seed?.stooqSymbol || instrument.symbol));
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
        // Keep ~1y
        bars = bars
          .slice()
          .sort((a, b) => (a.asOfYmd < b.asOfYmd ? 1 : -1))
          .slice(0, outputsize);
      } else {
        await pace();
        bars = await fetchTwelveDataTimeSeries(instrument.providerSymbol, {
          outputsize,
          fetchImpl,
          apiKey: options.apiKey,
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
