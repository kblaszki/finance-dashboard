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
  collapseClosesByDay,
  countDistinctClosesInWindow,
  historyWindowForYear,
  historyWindowFromMonths,
  instrumentCloseYearBounds,
  listInstrumentCloses,
  parseInstrumentHistoryMonths,
  parseInstrumentHistoryYear,
  upsertInstrumentClose,
  VALUATION_SOURCE_OANOR_GPW,
  VALUATION_SOURCE_STOOQ,
  VALUATION_SOURCE_TWELVE_DATA,
  VALUATION_SOURCE_YAHOO,
} from "./instrumentValuations";
import { utcDateFromYmd } from "./fx";

let prisma: PrismaClient;

before(async () => {
  prisma = await createTestPrisma();
});

after(async () => {
  await disconnectTestPrisma(prisma);
});

test("parseInstrumentHistoryMonths defaults and validates", () => {
  assert.equal(parseInstrumentHistoryMonths(undefined), 12);
  assert.equal(parseInstrumentHistoryMonths("3"), 3);
  assert.equal(parseInstrumentHistoryMonths(6), 6);
  assert.throws(() => parseInstrumentHistoryMonths("24"), /3, 6, or 12/);
});

test("parseInstrumentHistoryYear defaults and validates", () => {
  const now = new Date(Date.UTC(2026, 9, 31));
  assert.equal(parseInstrumentHistoryYear(undefined, now), null);
  assert.equal(parseInstrumentHistoryYear("2020", now), 2020);
  assert.throws(() => parseInstrumentHistoryYear("1989", now), /1990/);
  assert.throws(() => parseInstrumentHistoryYear("2027", now), /2026/);
});

test("historyWindowFromMonths spans months ending today UTC", () => {
  const now = new Date(Date.UTC(2026, 9, 31));
  const w = historyWindowFromMonths(3, now);
  assert.equal(w.toYmd, "2026-10-31");
  assert.equal(w.fromYmd, "2026-07-31");
});

test("historyWindowForYear uses full year or today for current", () => {
  const now = new Date(Date.UTC(2026, 9, 31));
  assert.deepEqual(historyWindowForYear(2024, now), {
    fromYmd: "2024-01-01",
    toYmd: "2024-12-31",
  });
  assert.deepEqual(historyWindowForYear(2026, now), {
    fromYmd: "2026-01-01",
    toYmd: "2026-10-31",
  });
});

test("collapseClosesByDay prefers yahoo over twelve_data over stooq over oanor", () => {
  const day = utcDateFromYmd("2026-10-15");
  const points = collapseClosesByDay([
    { asOfDate: day, close: 100, source: VALUATION_SOURCE_OANOR_GPW },
    { asOfDate: day, close: 101, source: VALUATION_SOURCE_STOOQ },
    { asOfDate: day, close: 102, source: VALUATION_SOURCE_TWELVE_DATA },
    { asOfDate: day, close: 103, source: VALUATION_SOURCE_YAHOO },
  ]);
  assert.deepEqual(points, [{ asOf: "2026-10-15", close: 103 }]);
});

test("listInstrumentCloses collapses and sorts ascending", async () => {
  await resetDatabase(prisma);
  const instrument = await prisma.instrument.create({
    data: {
      symbol: "AAA",
      name: "AAA Co",
      exchange: "NASDAQ",
      currency: "USD",
      assetClass: "STOCK",
      provider: INSTRUMENT_PROVIDER_TWELVE_DATA,
      providerSymbol: "AAA",
      allowlisted: true,
    },
  });
  await upsertInstrumentClose(prisma, {
    instrumentId: instrument.id,
    asOfYmd: "2026-10-10",
    close: 10,
    source: VALUATION_SOURCE_TWELVE_DATA,
  });
  await upsertInstrumentClose(prisma, {
    instrumentId: instrument.id,
    asOfYmd: "2026-10-11",
    close: 11,
    source: VALUATION_SOURCE_STOOQ,
  });
  await upsertInstrumentClose(prisma, {
    instrumentId: instrument.id,
    asOfYmd: "2026-10-11",
    close: 11.5,
    source: VALUATION_SOURCE_TWELVE_DATA,
  });
  await upsertInstrumentClose(prisma, {
    instrumentId: instrument.id,
    asOfYmd: "2026-01-01",
    close: 1,
    source: VALUATION_SOURCE_TWELVE_DATA,
  });

  const series = await listInstrumentCloses(prisma, instrument.id, {
    fromYmd: "2026-10-01",
    toYmd: "2026-10-31",
  });
  assert.deepEqual(series, [
    { asOf: "2026-10-10", close: 10 },
    { asOf: "2026-10-11", close: 11.5 },
  ]);

  const n = await countDistinctClosesInWindow(prisma, instrument.id, {
    fromYmd: "2026-10-01",
    toYmd: "2026-10-31",
  });
  assert.equal(n, 2);

  const bounds = await instrumentCloseYearBounds(prisma, instrument.id);
  assert.deepEqual(bounds, { oldestYear: 2026, newestYear: 2026 });
});
