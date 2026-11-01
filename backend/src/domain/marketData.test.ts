import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { PrismaClient } from "@prisma/client";
import {
  createTestPrisma,
  disconnectTestPrisma,
  resetDatabase,
} from "../../test/prismaTestClient";
import { setMarketLiveApi } from "./appConfig";
import { syncInstrumentCatalog, ensureInstrumentQuote } from "./marketData";
import { INSTRUMENT_PROVIDER_TWELVE_DATA } from "./instruments";
import { VALUATION_SOURCE_YAHOO } from "./instrumentValuations";

let prisma: PrismaClient;

before(async () => {
  prisma = await createTestPrisma();
});

after(async () => {
  await disconnectTestPrisma(prisma);
});

function yahooChartResponse(close: number, unixSec: number): Response {
  return new Response(
    JSON.stringify({
      chart: {
        result: [
          {
            timestamp: [unixSec],
            indicators: {
              adjclose: [{ adjclose: [close] }],
              quote: [{ close: [close] }],
            },
          },
        ],
        error: null,
      },
    }),
    { status: 200 },
  );
}

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

test("ensureInstrumentQuote fetches Yahoo close when missing", async () => {
  await resetDatabase(prisma);
  await setMarketLiveApi(prisma, true);
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

  // 2026-10-29 UTC
  const unixSec = Date.UTC(2026, 9, 29) / 1000;
  const fetchImpl = async (url: string) => {
    assert.match(url, /finance\.yahoo\.com|chart\/MSFT/);
    return yahooChartResponse(420.5, unixSec);
  };

  const first = await ensureInstrumentQuote(
    prisma,
    instrument.id,
    fetchImpl,
    new Date(Date.UTC(2026, 9, 30)),
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
  );
  assert.equal(second.fetched, false);
  assert.equal(second.close, 420.5);

  const valuation = await prisma.instrumentValuation.findFirst({
    where: { instrumentId: instrument.id },
  });
  assert.ok(valuation);
  assert.equal(valuation!.source, VALUATION_SOURCE_YAHOO);
});

test("ensureInstrumentQuote uses Yahoo for GPW instruments", async () => {
  await resetDatabase(prisma);
  await setMarketLiveApi(prisma, true);
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

  const unixSec = Date.UTC(2026, 9, 30) / 1000;
  const fetchImpl = async (url: string) => {
    assert.match(url, /ETFBW20TR\.WA/);
    return yahooChartResponse(53.45, unixSec);
  };

  const result = await ensureInstrumentQuote(
    prisma,
    instrument.id,
    fetchImpl,
    new Date(Date.UTC(2026, 9, 30)),
  );
  assert.equal(result.fetched, true);
  assert.equal(result.close, 53.45);
  assert.equal(result.asOfYmd, "2026-10-30");

  const valuation = await prisma.instrumentValuation.findFirst({
    where: { instrumentId: instrument.id },
  });
  assert.ok(valuation);
  assert.equal(valuation!.source, VALUATION_SOURCE_YAHOO);
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
    source: VALUATION_SOURCE_YAHOO,
  });
  const latest = await getLatestValuation(prisma, instrument.id);
  assert.ok(latest);
  assert.equal(Number(latest!.close), 12);
  assert.equal(latest!.source, VALUATION_SOURCE_YAHOO);
});
