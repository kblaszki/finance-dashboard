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
import { canonicalUsernameKey, hashPassword } from "../auth";
import { INSTRUMENT_PROVIDER_TWELVE_DATA } from "./instruments";
import { serializeHistoryNdjsonRow } from "./marketHistoryIo";
import { seedDemoMarkets } from "./seedDemoMarkets";

let prisma: PrismaClient;

before(async () => {
  prisma = await createTestPrisma();
});

after(async () => {
  await disconnectTestPrisma(prisma);
});

test("seedDemoMarkets adds watchlist and valuations from fixture", async () => {
  await resetDatabase(prisma);
  const user = await prisma.user.create({
    data: {
      email: "demomarkets@test.local",
      username: "demomarkets",
      usernameKey: canonicalUsernameKey("demomarkets"),
      passwordHash: await hashPassword("password123"),
    },
  });
  await prisma.instrument.create({
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

  const tmp = path.join(os.tmpdir(), `demo-eod-${process.pid}.ndjson`);
  fs.writeFileSync(
    tmp,
    [
      serializeHistoryNdjsonRow({
        provider: "twelve_data",
        providerSymbol: "AAPL",
        asOf: "2026-09-30",
        close: 200,
        source: "yahoo",
      }),
      serializeHistoryNdjsonRow({
        provider: "twelve_data",
        providerSymbol: "AAPL",
        asOf: "2026-10-31",
        close: 210,
        source: "yahoo",
      }),
      serializeHistoryNdjsonRow({
        provider: "twelve_data",
        providerSymbol: "MISSING",
        asOf: "2026-10-31",
        close: 1,
        source: "yahoo",
      }),
    ].join("\n") + "\n",
  );

  try {
    const result = await seedDemoMarkets(prisma, user.id, tmp);
    assert.equal(result.watchlistAdded, 1);
    assert.equal(result.valuationsUpserted, 2);
    assert.deepEqual(result.skippedMissingInstruments, ["MISSING"]);

    const wl = await prisma.watchlistItem.count({ where: { userId: user.id } });
    assert.equal(wl, 1);
    const vals = await prisma.instrumentValuation.count();
    assert.equal(vals, 2);
  } finally {
    fs.unlinkSync(tmp);
  }
});
