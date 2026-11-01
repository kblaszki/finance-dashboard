import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { PrismaClient } from "@prisma/client";
import {
  createTestPrisma,
  disconnectTestPrisma,
  resetDatabase,
} from "../../test/prismaTestClient";
import {
  getAppConfigPayload,
  getMarketLiveApi,
  getYahooGapSyncLastRunYmd,
  setMarketLiveApi,
  setYahooGapSyncLastRunYmd,
} from "./appConfig";

let prisma: PrismaClient;

before(async () => {
  prisma = await createTestPrisma();
});

after(async () => {
  await disconnectTestPrisma(prisma);
});

test("getMarketLiveApi defaults to false when unset", async () => {
  await resetDatabase(prisma);
  assert.equal(await getMarketLiveApi(prisma), false);
  assert.deepEqual(await getAppConfigPayload(prisma), {
    marketLiveApi: false,
  });
});

test("setMarketLiveApi persists true and false", async () => {
  await resetDatabase(prisma);
  assert.equal(await setMarketLiveApi(prisma, true), true);
  assert.equal(await getMarketLiveApi(prisma), true);
  assert.equal(await setMarketLiveApi(prisma, false), false);
  assert.equal(await getMarketLiveApi(prisma), false);
});

test("yahoo gap-sync last-run AppConfig round-trip", async () => {
  await resetDatabase(prisma);
  assert.equal(await getYahooGapSyncLastRunYmd(prisma), null);
  assert.equal(await setYahooGapSyncLastRunYmd(prisma, "2026-11-01"), "2026-11-01");
  assert.equal(await getYahooGapSyncLastRunYmd(prisma), "2026-11-01");
});
