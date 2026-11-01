import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { PrismaClient } from "@prisma/client";
import {
  createTestPrisma,
  disconnectTestPrisma,
  resetDatabase,
} from "../../test/prismaTestClient";
import { INSTRUMENT_PROVIDER_TWELVE_DATA } from "./instruments";
import {
  upsertInstrumentClose,
  VALUATION_SOURCE_YAHOO,
} from "./instrumentValuations";
import {
  barsAfterLastYmd,
  calendarDaysSinceLastClose,
  syncYahooAllowlistGaps,
  syncYahooHistory,
  yahooRangeForGapDays,
} from "./yahooHistory";

let prisma: PrismaClient;

before(async () => {
  prisma = await createTestPrisma();
});

after(async () => {
  await disconnectTestPrisma(prisma);
});

test("syncYahooHistory upserts closes for sparse instrument", async () => {
  await resetDatabase(prisma);
  const instrument = await prisma.instrument.create({
    data: {
      symbol: "SPX",
      name: "S&P 500",
      exchange: "NEO",
      currency: "USD",
      assetClass: "INDEX",
      provider: INSTRUMENT_PROVIDER_TWELVE_DATA,
      providerSymbol: "SPX",
      allowlisted: true,
    },
  });

  const result = await syncYahooHistory(prisma, {
    instrumentId: instrument.id,
    force: true,
    delayMs: 0,
    fetchImpl: async (url) => {
      assert.match(String(url), /GSPC|%5EGSPC/);
      return new Response(
        JSON.stringify({
          chart: {
            result: [
              {
                timestamp: [1_698_624_000, 1_698_710_400],
                indicators: {
                  quote: [{ close: [5000, 5010] }],
                  adjclose: [{ adjclose: [5000, 5010] }],
                },
              },
            ],
          },
        }),
        { status: 200 },
      );
    },
  });

  assert.equal(result.updatedInstruments, 1);
  assert.equal(result.barsUpserted, 2);
  const rows = await prisma.instrumentValuation.findMany({
    where: { instrumentId: instrument.id, source: VALUATION_SOURCE_YAHOO },
  });
  assert.equal(rows.length, 2);
});

test("yahooRangeForGapDays and barsAfterLastYmd helpers", () => {
  assert.equal(yahooRangeForGapDays(2), "5d");
  assert.equal(yahooRangeForGapDays(10), "1mo");
  assert.equal(yahooRangeForGapDays(40), "3mo");
  assert.equal(yahooRangeForGapDays(200), "1y");
  assert.equal(yahooRangeForGapDays(Number.POSITIVE_INFINITY), "1y");

  const now = new Date(Date.UTC(2026, 10, 1));
  const threeDaysAgo = new Date(Date.UTC(2026, 9, 29));
  assert.equal(calendarDaysSinceLastClose(threeDaysAgo, now), 3);
  assert.equal(calendarDaysSinceLastClose(null, now), Number.POSITIVE_INFINITY);

  assert.deepEqual(
    barsAfterLastYmd(
      [
        { asOfYmd: "2026-10-28", close: 1 },
        { asOfYmd: "2026-10-29", close: 2 },
        { asOfYmd: "2026-10-30", close: 3 },
      ],
      "2026-10-29",
    ),
    [{ asOfYmd: "2026-10-30", close: 3 }],
  );
});

test("syncYahooAllowlistGaps upserts bars after last valuation and day-locks", async () => {
  await resetDatabase(prisma);
  const instrument = await prisma.instrument.create({
    data: {
      symbol: "AAPL",
      name: "Apple",
      exchange: "NASDAQ",
      currency: "USD",
      assetClass: "STOCK",
      provider: INSTRUMENT_PROVIDER_TWELVE_DATA,
      providerSymbol: "AAPL",
      allowlisted: true,
    },
  });

  await upsertInstrumentClose(prisma, {
    instrumentId: instrument.id,
    asOfYmd: "2026-10-28",
    close: 100,
    source: VALUATION_SOURCE_YAHOO,
  });

  const now = new Date(Date.UTC(2026, 10, 1, 12, 0, 0));
  let fetches = 0;
  const fetchImpl = async () => {
    fetches += 1;
    return new Response(
      JSON.stringify({
        chart: {
          result: [
            {
              timestamp: [
                Date.UTC(2026, 9, 28) / 1000,
                Date.UTC(2026, 9, 29) / 1000,
                Date.UTC(2026, 9, 30) / 1000,
                Date.UTC(2026, 9, 31) / 1000,
              ],
              indicators: {
                quote: [{ close: [100, 101, 102, 103] }],
                adjclose: [{ adjclose: [100, 101, 102, 103] }],
              },
            },
          ],
        },
      }),
      { status: 200 },
    );
  };

  const first = await syncYahooAllowlistGaps(prisma, {
    delayMs: 0,
    now,
    fetchImpl,
  });
  assert.equal(first.skippedDueToDayLock, false);
  assert.equal(first.updatedInstruments, 1);
  assert.equal(first.barsUpserted, 3);
  assert.equal(fetches, 1);

  const second = await syncYahooAllowlistGaps(prisma, {
    delayMs: 0,
    now,
    fetchImpl,
  });
  assert.equal(second.skippedDueToDayLock, true);
  assert.equal(second.attempted, 0);
  assert.equal(fetches, 1);

  const forced = await syncYahooAllowlistGaps(prisma, {
    force: true,
    delayMs: 0,
    now,
    fetchImpl,
  });
  assert.equal(forced.skippedDueToDayLock, false);
  assert.equal(forced.skippedFresh, 1);
  assert.equal(fetches, 1);
});

test("syncYahooAllowlistGaps skips fresh valuations without Yahoo", async () => {
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
      allowlisted: true,
    },
  });
  const now = new Date(Date.UTC(2026, 10, 1, 15, 0, 0));
  await upsertInstrumentClose(prisma, {
    instrumentId: instrument.id,
    asOfYmd: "2026-11-01",
    close: 400,
    source: VALUATION_SOURCE_YAHOO,
  });

  let fetches = 0;
  const result = await syncYahooAllowlistGaps(prisma, {
    force: true,
    delayMs: 0,
    now,
    fetchImpl: async () => {
      fetches += 1;
      return new Response("{}", { status: 200 });
    },
  });
  assert.equal(result.skippedFresh, 1);
  assert.equal(result.updatedInstruments, 0);
  assert.equal(fetches, 0);
});
