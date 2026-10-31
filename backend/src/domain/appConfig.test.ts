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
  setMarketLiveApi,
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
