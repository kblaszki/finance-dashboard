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
