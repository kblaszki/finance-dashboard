import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { PrismaClient } from "@prisma/client";
import {
  createTestPrisma,
  disconnectTestPrisma,
  resetDatabase,
} from "../../test/prismaTestClient";
import { setMarketLiveApi } from "./appConfig";
import { INSTRUMENT_PROVIDER_TWELVE_DATA } from "./instruments";
import {
  upsertInstrumentClose,
  VALUATION_SOURCE_TWELVE_DATA,
} from "./instrumentValuations";
import {
  ensureInstrumentHistory,
  HISTORY_SPARSE_THRESHOLD,
} from "./marketHistory";

let prisma: PrismaClient;

before(async () => {
  prisma = await createTestPrisma();
});

after(async () => {
  await disconnectTestPrisma(prisma);
});

test("ensureInstrumentHistory skips live fetch when marketLiveApi is off", async () => {
  await resetDatabase(prisma);
  await setMarketLiveApi(prisma, false);
  const instrument = await prisma.instrument.create({
    data: {
      symbol: "OFF",
      name: "Off Co",
      exchange: "NASDAQ",
      currency: "USD",
      assetClass: "STOCK",
      provider: INSTRUMENT_PROVIDER_TWELVE_DATA,
      providerSymbol: "OFF",
      allowlisted: true,
    },
  });
  let fetchCalls = 0;
  const result = await ensureInstrumentHistory(prisma, instrument.id, {
    now: new Date(Date.UTC(2026, 9, 31)),
    fetchImpl: async () => {
      fetchCalls += 1;
      return new Response("{}", { status: 200 });
    },
    apiKey: "test-key",
  });
  assert.equal(result.backfilled, false);
  assert.equal(fetchCalls, 0);
});

test("ensureInstrumentHistory skips when series is dense", async () => {
  await resetDatabase(prisma);
  await setMarketLiveApi(prisma, true);
  const instrument = await prisma.instrument.create({
    data: {
      symbol: "DENSE",
      name: "Dense Co",
      exchange: "NASDAQ",
      currency: "USD",
      assetClass: "STOCK",
      provider: INSTRUMENT_PROVIDER_TWELVE_DATA,
      providerSymbol: "DENSE",
      allowlisted: true,
    },
  });
  const now = new Date(Date.UTC(2026, 9, 31));
  for (let i = 0; i < HISTORY_SPARSE_THRESHOLD; i += 1) {
    const d = new Date(Date.UTC(2026, 9, 31 - i));
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    await upsertInstrumentClose(prisma, {
      instrumentId: instrument.id,
      asOfYmd: `${y}-${m}-${day}`,
      close: 100 + i,
      source: VALUATION_SOURCE_TWELVE_DATA,
    });
  }

  let fetchCalls = 0;
  const result = await ensureInstrumentHistory(prisma, instrument.id, {
    now,
    fetchImpl: async () => {
      fetchCalls += 1;
      return new Response("{}", { status: 200 });
    },
    apiKey: "test-key",
  });
  assert.equal(result.backfilled, false);
  assert.equal(fetchCalls, 0);
});

test("ensureInstrumentHistory soft-fails when provider errors", async () => {
  await resetDatabase(prisma);
  await setMarketLiveApi(prisma, true);
  const instrument = await prisma.instrument.create({
    data: {
      symbol: "SPARSE",
      name: "Sparse Co",
      exchange: "NASDAQ",
      currency: "USD",
      assetClass: "STOCK",
      provider: INSTRUMENT_PROVIDER_TWELVE_DATA,
      providerSymbol: "SPARSE",
      allowlisted: true,
    },
  });

  const result = await ensureInstrumentHistory(prisma, instrument.id, {
    now: new Date(Date.UTC(2026, 9, 31)),
    fetchImpl: async () => {
      throw new Error("provider down");
    },
    apiKey: "test-key",
  });
  assert.equal(result.backfilled, false);
  assert.match(String(result.backfillMessage), /provider down|history/i);
});

test("ensureInstrumentHistory backfills via Yahoo chart", async () => {
  await resetDatabase(prisma);
  await setMarketLiveApi(prisma, true);
  const instrument = await prisma.instrument.create({
    data: {
      symbol: "FILL",
      name: "Fill Co",
      exchange: "NASDAQ",
      currency: "USD",
      assetClass: "STOCK",
      provider: INSTRUMENT_PROVIDER_TWELVE_DATA,
      providerSymbol: "FILL",
      allowlisted: true,
    },
  });

  const result = await ensureInstrumentHistory(prisma, instrument.id, {
    now: new Date(Date.UTC(2026, 9, 31)),
    fetchImpl: async (input) => {
      const url = String(input);
      assert.match(url, /chart\/FILL|finance\.yahoo/);
      const t0 = Date.UTC(2026, 9, 29) / 1000;
      const t1 = Date.UTC(2026, 9, 30) / 1000;
      return new Response(
        JSON.stringify({
          chart: {
            result: [
              {
                timestamp: [t0, t1],
                indicators: {
                  adjclose: [{ adjclose: [12.0, 12.5] }],
                  quote: [{ close: [12.0, 12.5] }],
                },
              },
            ],
            error: null,
          },
        }),
        { status: 200 },
      );
    },
  });
  assert.equal(result.backfilled, true);

  const count = await prisma.instrumentValuation.count({
    where: { instrumentId: instrument.id },
  });
  assert.equal(count, 2);
});
