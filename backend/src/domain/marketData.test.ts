import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { PrismaClient } from "@prisma/client";
import {
  createTestPrisma,
  disconnectTestPrisma,
  resetDatabase,
} from "../../test/prismaTestClient";
import { syncInstrumentCatalog, ensureInstrumentQuote } from "./marketData";
import { INSTRUMENT_PROVIDER_TWELVE_DATA } from "./instruments";
import { VALUATION_SOURCE_OANOR_GPW } from "./instrumentValuations";

let prisma: PrismaClient;

before(async () => {
  prisma = await createTestPrisma();
});

after(async () => {
  await disconnectTestPrisma(prisma);
});

test("syncInstrumentCatalog upserts stocks and etfs from mocked fetch", async () => {
  await resetDatabase(prisma);
  let calls = 0;
  const fetchImpl = async (url: string) => {
    calls += 1;
    const isEtf = url.includes("/etfs");
    const data = isEtf
      ? [{ symbol: "VOO", name: "Vanguard", exchange: "NYSE", currency: "USD" }]
      : [
          {
            symbol: "AAPL",
            name: "Apple",
            exchange: "NASDAQ",
            currency: "USD",
            mic_code: "XNAS",
            country: "United States",
          },
        ];
    return new Response(JSON.stringify({ data }), { status: 200 });
  };

  const result = await syncInstrumentCatalog(prisma, fetchImpl, "test-key");
  assert.equal(result.stocksUpserted, 1);
  assert.equal(result.etfsUpserted, 1);
  assert.equal(calls, 2);

  const apple = await prisma.instrument.findFirst({
    where: {
      provider: INSTRUMENT_PROVIDER_TWELVE_DATA,
      providerSymbol: "AAPL",
    },
  });
  assert.ok(apple);
  assert.equal(apple!.assetClass, "STOCK");
  assert.equal(apple!.name, "Apple");
});

test("ensureInstrumentQuote fetches and stores close when missing", async () => {
  await resetDatabase(prisma);
  const instrument = await prisma.instrument.create({
    data: {
      symbol: "MSFT",
      name: "Microsoft",
      exchange: "NASDAQ",
      currency: "USD",
      assetClass: "STOCK",
      provider: INSTRUMENT_PROVIDER_TWELVE_DATA,
      providerSymbol: "MSFT",
    },
  });

  const fetchImpl = async () =>
    new Response(
      JSON.stringify({
        symbol: "MSFT",
        close: "420.5",
        datetime: "2026-10-29 16:00:00",
        currency: "USD",
      }),
      { status: 200 },
    );

  const first = await ensureInstrumentQuote(
    prisma,
    instrument.id,
    fetchImpl,
    new Date(Date.UTC(2026, 9, 30)),
    "test-key",
  );
  assert.equal(first.fetched, true);
  assert.equal(first.asOfYmd, "2026-10-29");
  assert.equal(first.close, 420.5);

  const second = await ensureInstrumentQuote(
    prisma,
    instrument.id,
    async () => {
      throw new Error("should not call");
    },
    new Date(Date.UTC(2026, 9, 30)),
    "test-key",
  );
  assert.equal(second.fetched, false);
  assert.equal(second.close, 420.5);
});

test("ensureInstrumentQuote uses Oanor for GPW instruments", async () => {
  await resetDatabase(prisma);
  const instrument = await prisma.instrument.create({
    data: {
      symbol: "ETFBW20TR",
      name: "Beta ETF WIG20TR",
      exchange: "GPW",
      country: "Poland",
      currency: "PLN",
      assetClass: "ETF",
      provider: INSTRUMENT_PROVIDER_TWELVE_DATA,
      providerSymbol: "ETFBW20TR",
    },
  });

  const fetchImpl = async (url: string) => {
    assert.match(url, /gpw-api\/v1\/quote/);
    return new Response(
      JSON.stringify({
        success: true,
        status: "ok",
        data: {
          quotes: [
            { ticker: "ETFBW20TR", price: 53.45, currency: "PLN" },
          ],
        },
        meta: { timestamp: "2026-10-30T14:00:00.000Z" },
      }),
      { status: 200 },
    );
  };

  const result = await ensureInstrumentQuote(
    prisma,
    instrument.id,
    fetchImpl,
    new Date(Date.UTC(2026, 9, 30)),
    undefined,
    "oanor-test-key",
  );
  assert.equal(result.fetched, true);
  assert.equal(result.close, 53.45);
  assert.equal(result.asOfYmd, "2026-10-30");

  const valuation = await prisma.instrumentValuation.findFirst({
    where: { instrumentId: instrument.id },
  });
  assert.ok(valuation);
  assert.equal(valuation!.source, VALUATION_SOURCE_OANOR_GPW);
});

test("getLatestValuation returns newest across sources", async () => {
  await resetDatabase(prisma);
  const instrument = await prisma.instrument.create({
    data: {
      symbol: "X",
      name: "X",
      exchange: "GPW",
      currency: "PLN",
      assetClass: "STOCK",
      provider: INSTRUMENT_PROVIDER_TWELVE_DATA,
      providerSymbol: "X",
    },
  });
  const { upsertInstrumentClose, getLatestValuation } = await import(
    "./instrumentValuations"
  );
  await upsertInstrumentClose(prisma, {
    instrumentId: instrument.id,
    asOfYmd: "2026-10-28",
    close: 10,
    source: "twelve_data",
  });
  await upsertInstrumentClose(prisma, {
    instrumentId: instrument.id,
    asOfYmd: "2026-10-30",
    close: 12,
    source: VALUATION_SOURCE_OANOR_GPW,
  });
  const latest = await getLatestValuation(prisma, instrument.id);
  assert.ok(latest);
  assert.equal(Number(latest!.close), 12);
  assert.equal(latest!.source, VALUATION_SOURCE_OANOR_GPW);
});
