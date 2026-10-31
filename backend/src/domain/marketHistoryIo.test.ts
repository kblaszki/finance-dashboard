import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import type { PrismaClient } from "@prisma/client";
import {
  createTestPrisma,
  disconnectTestPrisma,
  resetDatabase,
} from "../../test/prismaTestClient";
import { INSTRUMENT_PROVIDER_TWELVE_DATA } from "./instruments";
import {
  downsampleHistoryMonthly,
  exportInstrumentHistory,
  filterHistoryByMonths,
  importInstrumentHistory,
  parseHistoryNdjson,
  serializeHistoryNdjsonRow,
  type HistoryNdjsonRow,
} from "./marketHistoryIo";
import {
  upsertInstrumentClose,
  VALUATION_SOURCE_YAHOO,
} from "./instrumentValuations";

let prisma: PrismaClient;

before(async () => {
  prisma = await createTestPrisma();
});

after(async () => {
  await disconnectTestPrisma(prisma);
});

test("parse and serialize NDJSON round-trip", () => {
  const row: HistoryNdjsonRow = {
    provider: "twelve_data",
    providerSymbol: "AAPL",
    asOf: "2026-10-15",
    close: 190.5,
    source: "yahoo",
  };
  const line = serializeHistoryNdjsonRow(row);
  const parsed = parseHistoryNdjson(line + "\n");
  assert.deepEqual(parsed, [row]);
});

test("filterHistoryByMonths and downsampleHistoryMonthly", () => {
  const rows: HistoryNdjsonRow[] = [
    {
      provider: "twelve_data",
      providerSymbol: "AAPL",
      asOf: "2026-01-05",
      close: 100,
      source: "yahoo",
    },
    {
      provider: "twelve_data",
      providerSymbol: "AAPL",
      asOf: "2026-01-20",
      close: 110,
      source: "yahoo",
    },
    {
      provider: "twelve_data",
      providerSymbol: "AAPL",
      asOf: "2026-02-10",
      close: 120,
      source: "yahoo",
    },
    {
      provider: "twelve_data",
      providerSymbol: "AAPL",
      asOf: "2025-01-01",
      close: 50,
      source: "yahoo",
    },
  ];
  const now = new Date(Date.UTC(2026, 9, 31));
  const filtered = filterHistoryByMonths(rows, 12, now);
  assert.equal(filtered.length, 3);
  const monthly = downsampleHistoryMonthly(filtered);
  assert.deepEqual(
    monthly.map((r) => ({ asOf: r.asOf, close: r.close })),
    [
      { asOf: "2026-01-20", close: 110 },
      { asOf: "2026-02-10", close: 120 },
    ],
  );
});

test("export then import valuations", async () => {
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
    asOfYmd: "2026-09-30",
    close: 200,
    source: VALUATION_SOURCE_YAHOO,
  });
  await upsertInstrumentClose(prisma, {
    instrumentId: instrument.id,
    asOfYmd: "2026-10-15",
    close: 210,
    source: VALUATION_SOURCE_YAHOO,
  });

  const tmp = path.join(os.tmpdir(), `hist-io-${process.pid}.ndjson`);
  try {
    const exported = await exportInstrumentHistory(prisma, {
      filePath: tmp,
      months: 12,
      monthly: true,
    });
    assert.equal(exported.rowsWritten, 2);

    await prisma.instrumentValuation.deleteMany();
    const imported = await importInstrumentHistory(prisma, tmp);
    assert.equal(imported.upserted, 2);
    assert.equal(imported.skippedUnknownInstrument, 0);

    const count = await prisma.instrumentValuation.count({
      where: { instrumentId: instrument.id },
    });
    assert.equal(count, 2);
  } finally {
    fs.unlinkSync(tmp);
  }
});

test("import skips unknown instruments with warning", async () => {
  await resetDatabase(prisma);
  const tmp = path.join(os.tmpdir(), `hist-io-miss-${process.pid}.ndjson`);
  fs.writeFileSync(
    tmp,
    serializeHistoryNdjsonRow({
      provider: "twelve_data",
      providerSymbol: "NOSUCH",
      asOf: "2026-10-01",
      close: 1,
      source: "yahoo",
    }) + "\n",
  );
  try {
    const result = await importInstrumentHistory(prisma, tmp);
    assert.equal(result.upserted, 0);
    assert.equal(result.skippedUnknownInstrument, 1);
    assert.ok(result.warnings.length >= 1);
  } finally {
    fs.unlinkSync(tmp);
  }
});
