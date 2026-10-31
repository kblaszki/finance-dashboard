import fs from "node:fs";
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  DEMO_MARKET_WATCHLIST_SYMBOLS,
  marketHistoryDataDir,
  readHistoryNdjsonFile,
  resolveDemoHistorySource,
  uniqueProviderSymbolsFromHistory,
  type DemoHistorySourceKind,
} from "./marketHistoryIo";
import { INSTRUMENT_PROVIDER_TWELVE_DATA } from "./instruments";
import { upsertInstrumentClose } from "./instrumentValuations";

type Db = PrismaClient | Prisma.TransactionClient;

export type SeedDemoMarketsResult = {
  watchlistAdded: number;
  valuationsUpserted: number;
  skippedMissingInstruments: string[];
  fixturePath: string;
  fixtureMissing: boolean;
  sourceKind: DemoHistorySourceKind;
};

export type SeedDemoMarketsOptions = {
  /** Explicit history file (tests). Skips local-export vs fixture resolve. */
  historyFile?: string;
  historyDir?: string;
};

/**
 * Attach demo watchlist favorites and load EOD closes from disk.
 * Prefers `exports/allowlist-eod.ndjson.gz` when present; else committed `demo-eod.ndjson`.
 * Never calls market APIs.
 */
export async function seedDemoMarkets(
  db: Db,
  userId: number,
  options: SeedDemoMarketsOptions = {},
): Promise<SeedDemoMarketsResult> {
  await db.watchlistItem.deleteMany({ where: { userId } });

  const historyDir = options.historyDir ?? marketHistoryDataDir();
  let sourceKind: DemoHistorySourceKind;
  let historyPath: string;

  if (options.historyFile) {
    historyPath = options.historyFile;
    sourceKind = fs.existsSync(historyPath) ? "committed-fixture" : "missing";
  } else {
    const resolved = resolveDemoHistorySource(historyDir);
    historyPath = resolved.path;
    sourceKind = resolved.kind;
  }

  if (sourceKind === "missing" || !fs.existsSync(historyPath)) {
    return {
      watchlistAdded: 0,
      valuationsUpserted: 0,
      skippedMissingInstruments: [],
      fixturePath: historyPath,
      fixtureMissing: true,
      sourceKind: "missing",
    };
  }

  const rows = readHistoryNdjsonFile(historyPath);
  const symbolsInFile = uniqueProviderSymbolsFromHistory(rows);
  const skippedMissingInstruments: string[] = [];
  let watchlistAdded = 0;
  let valuationsUpserted = 0;

  const instrumentBySymbol = new Map<string, number>();
  for (const providerSymbol of symbolsInFile) {
    const instrument = await db.instrument.findUnique({
      where: {
        provider_providerSymbol: {
          provider: INSTRUMENT_PROVIDER_TWELVE_DATA,
          providerSymbol,
        },
      },
      select: { id: true },
    });
    if (!instrument) {
      skippedMissingInstruments.push(providerSymbol);
      continue;
    }
    instrumentBySymbol.set(providerSymbol, instrument.id);
  }

  const fixtureInstrumentIds = [...instrumentBySymbol.values()];
  if (fixtureInstrumentIds.length > 0) {
    await db.instrumentValuation.deleteMany({
      where: { instrumentId: { in: fixtureInstrumentIds } },
    });
  }

  for (const row of rows) {
    const instrumentId = instrumentBySymbol.get(row.providerSymbol);
    if (instrumentId == null) continue;
    await upsertInstrumentClose(db, {
      instrumentId,
      asOfYmd: row.asOf,
      close: row.close,
      source: row.source,
    });
    valuationsUpserted += 1;
  }

  // Full local export → curated 5 favorites. Sparse committed/test file → symbols in file.
  const watchlistSymbols =
    sourceKind === "local-export"
      ? [...DEMO_MARKET_WATCHLIST_SYMBOLS]
      : symbolsInFile;

  for (const providerSymbol of watchlistSymbols) {
    const instrumentId = instrumentBySymbol.get(providerSymbol);
    if (instrumentId == null) {
      if (
        sourceKind === "local-export" &&
        !skippedMissingInstruments.includes(providerSymbol)
      ) {
        skippedMissingInstruments.push(providerSymbol);
      }
      continue;
    }
    await db.watchlistItem.create({
      data: { userId, instrumentId },
    });
    watchlistAdded += 1;
  }

  return {
    watchlistAdded,
    valuationsUpserted,
    skippedMissingInstruments,
    fixturePath: historyPath,
    fixtureMissing: false,
    sourceKind,
  };
}
