import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { PrismaClient } from "@prisma/client";
import {
  createTestPrisma,
  disconnectTestPrisma,
  resetDatabase,
} from "../../test/prismaTestClient";
import { INSTRUMENT_PROVIDER_TWELVE_DATA } from "./instruments";
import { VALUATION_SOURCE_YAHOO } from "./instrumentValuations";
import { syncYahooHistory } from "./yahooHistory";

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
