import fs from "node:fs";
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  demoHistoryFixturePath,
  parseHistoryNdjson,
  uniqueProviderSymbolsFromHistory,
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
};

/**
 * Attach demo watchlist favorites and load sparse EOD closes from the committed
 * fixture. Never calls market APIs. No-op (with warnings) when instruments are
 * not in the local catalog yet.
 */
export async function seedDemoMarkets(
  db: Db,
  userId: number,
  fixturePath: string = demoHistoryFixturePath(),
): Promise<SeedDemoMarketsResult> {
  await db.watchlistItem.deleteMany({ where: { userId } });

  if (!fs.existsSync(fixturePath)) {
    return {
      watchlistAdded: 0,
      valuationsUpserted: 0,
      skippedMissingInstruments: [],
      fixturePath,
      fixtureMissing: true,
    };
  }

  const rows = parseHistoryNdjson(fs.readFileSync(fixturePath, "utf8"));
  const symbols = uniqueProviderSymbolsFromHistory(rows);
  const skippedMissingInstruments: string[] = [];
  let watchlistAdded = 0;
  let valuationsUpserted = 0;

  const instrumentBySymbol = new Map<string, number>();
  for (const providerSymbol of symbols) {
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
    await db.watchlistItem.create({
      data: { userId, instrumentId: instrument.id },
    });
    watchlistAdded += 1;
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

  return {
    watchlistAdded,
    valuationsUpserted,
    skippedMissingInstruments,
    fixturePath,
    fixtureMissing: false,
  };
}
