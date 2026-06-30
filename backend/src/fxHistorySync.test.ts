import { test } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { FX_HISTORY_SOURCE, getFxRateOnDate, syncFxRatesSinceEpoch } from "./fxHistorySync";

const prisma = new PrismaClient();

function nbpResponse(rates: Array<{ effectiveDate: string; mid: number }>) {
  return {
    ok: true,
    json: async () => ({ rates }),
  } as Response;
}

test("syncFxRatesSinceEpoch upserts NBP USD/PLN rows", async () => {
  const mockFetch = async (url: string) => {
    if (url.includes("/USD/")) {
      return nbpResponse([
        { effectiveDate: "2020-01-02", mid: 3.8 },
        { effectiveDate: "2020-01-03", mid: 3.81 },
      ]);
    }
    return nbpResponse([{ effectiveDate: "2020-01-02", mid: 4.3 }]);
  };

  const result = await syncFxRatesSinceEpoch(prisma, {
    fetchFn: mockFetch,
    endDate: new Date(Date.UTC(2020, 0, 3)),
  });

  assert.ok(result.upserted >= 3);
  const rate = await getFxRateOnDate(prisma, "USD", "PLN", new Date(Date.UTC(2020, 0, 2)));
  assert.equal(rate, 3.8);
});

test("getFxRateOnDate returns 1 for PLN/PLN", async () => {
  const rate = await getFxRateOnDate(prisma, "PLN", "PLN", new Date(Date.UTC(2020, 0, 2)));
  assert.equal(rate, 1);
});

test("getFxRateOnDate inverts PLN legs and crosses via PLN", async () => {
  const day = new Date(Date.UTC(2020, 0, 2));
  await prisma.fxRateDaily.upsert({
    where: {
      rateDate_baseCurrency_quoteCurrency_source: {
        rateDate: day,
        baseCurrency: "USD",
        quoteCurrency: "PLN",
        source: FX_HISTORY_SOURCE,
      },
    },
    create: {
      rateDate: day,
      baseCurrency: "USD",
      quoteCurrency: "PLN",
      rate: 4,
      source: FX_HISTORY_SOURCE,
    },
    update: { rate: 4 },
  });
  await prisma.fxRateDaily.upsert({
    where: {
      rateDate_baseCurrency_quoteCurrency_source: {
        rateDate: day,
        baseCurrency: "EUR",
        quoteCurrency: "PLN",
        source: FX_HISTORY_SOURCE,
      },
    },
    create: {
      rateDate: day,
      baseCurrency: "EUR",
      quoteCurrency: "PLN",
      rate: 4.5,
      source: FX_HISTORY_SOURCE,
    },
    update: { rate: 4.5 },
  });

  const plnPerUsd = await getFxRateOnDate(prisma, "PLN", "USD", day);
  assert.equal(plnPerUsd, 0.25);

  const eurUsd = await getFxRateOnDate(prisma, "EUR", "USD", day);
  assert.ok(eurUsd != null && Math.abs(eurUsd - 1.125) < 0.0001);
});

test("syncFxRatesSinceEpoch records errors for failed NBP fetch", async () => {
  const mockFetch = async () => ({ ok: false, status: 503 }) as Response;
  const result = await syncFxRatesSinceEpoch(prisma, { fetchFn: mockFetch });
  assert.equal(result.errors.length, 2);
  assert.equal(result.upserted, 0);
});
