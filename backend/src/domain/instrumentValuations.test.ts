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
  getLatestValuationsByInstrumentIds,
  historyWindowForYear,
  historyWindowFromMonths,
  instrumentCloseYearBounds,
  listInstrumentCloses,
  loadValuationsForAsOfReplay,
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

test("getLatestValuationsByInstrumentIds returns newest day and prefers yahoo", async () => {
  await resetDatabase(prisma);
  const a = await prisma.instrument.create({
    data: {
      symbol: "LAT",
      name: "Latest",
      exchange: "NASDAQ",
      currency: "USD",
      assetClass: "STOCK",
      provider: INSTRUMENT_PROVIDER_TWELVE_DATA,
      providerSymbol: "LAT",
      allowlisted: true,
    },
  });
  const b = await prisma.instrument.create({
    data: {
      symbol: "LAT2",
      name: "Latest 2",
      exchange: "NASDAQ",
      currency: "USD",
      assetClass: "STOCK",
      provider: INSTRUMENT_PROVIDER_TWELVE_DATA,
      providerSymbol: "LAT2",
      allowlisted: true,
    },
  });
  await upsertInstrumentClose(prisma, {
    instrumentId: a.id,
    asOfYmd: "2025-01-01",
    close: 1,
    source: VALUATION_SOURCE_TWELVE_DATA,
  });
  await upsertInstrumentClose(prisma, {
    instrumentId: a.id,
    asOfYmd: "2026-10-01",
    close: 50,
    source: VALUATION_SOURCE_TWELVE_DATA,
  });
  await upsertInstrumentClose(prisma, {
    instrumentId: a.id,
    asOfYmd: "2026-10-01",
    close: 55,
    source: VALUATION_SOURCE_YAHOO,
  });
  await upsertInstrumentClose(prisma, {
    instrumentId: b.id,
    asOfYmd: "2026-09-15",
    close: 9,
    source: VALUATION_SOURCE_TWELVE_DATA,
  });

  const latest = await getLatestValuationsByInstrumentIds(prisma, [
    a.id,
    b.id,
    a.id,
  ]);
  assert.equal(latest.size, 2);
  assert.equal(Number(latest.get(a.id)!.close), 55);
  assert.equal(latest.get(a.id)!.source, VALUATION_SOURCE_YAHOO);
  assert.equal(Number(latest.get(b.id)!.close), 9);
});

test("loadValuationsForAsOfReplay bounds window and carry-forward", async () => {
  await resetDatabase(prisma);
  const instrument = await prisma.instrument.create({
    data: {
      symbol: "REP",
      name: "Replay",
      exchange: "NASDAQ",
      currency: "USD",
      assetClass: "STOCK",
      provider: INSTRUMENT_PROVIDER_TWELVE_DATA,
      providerSymbol: "REP",
      allowlisted: true,
    },
  });
  await upsertInstrumentClose(prisma, {
    instrumentId: instrument.id,
    asOfYmd: "2024-06-01",
    close: 10,
    source: VALUATION_SOURCE_YAHOO,
  });
  await upsertInstrumentClose(prisma, {
    instrumentId: instrument.id,
    asOfYmd: "2026-01-15",
    close: 20,
    source: VALUATION_SOURCE_YAHOO,
  });
  await upsertInstrumentClose(prisma, {
    instrumentId: instrument.id,
    asOfYmd: "2026-02-15",
    close: 30,
    source: VALUATION_SOURCE_YAHOO,
  });
  await upsertInstrumentClose(prisma, {
    instrumentId: instrument.id,
    asOfYmd: "2026-05-01",
    close: 99,
    source: VALUATION_SOURCE_YAHOO,
  });

  const windowStart = utcDateFromYmd("2026-01-01");
  const exclusiveEnd = utcDateFromYmd("2026-03-01");
  const rows = await loadValuationsForAsOfReplay(
    prisma,
    [instrument.id],
    windowStart,
    exclusiveEnd,
  );
  // Carry-forward 2024-06 + Jan/Feb window; May after exclusiveEnd omitted
  assert.equal(rows.length, 3);
  const closes = rows.map((r) => Number(r.close)).sort((x, y) => x - y);
  assert.deepEqual(closes, [10, 20, 30]);
});
