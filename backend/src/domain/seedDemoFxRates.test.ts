import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import {
  buildDemoFxFallbackRows,
  seedDemoFxRates,
} from "./seedDemoFxRates";
import { getMidOnOrBefore } from "./fxRates";
import { utcDateFromYmd } from "./fx";
import {
  createTestPrisma,
  disconnectTestPrisma,
  resetDatabase,
} from "../../test/prismaTestClient";

test("buildDemoFxFallbackRows covers EUR and USD for month-ends and today", () => {
  const now = utcDateFromYmd("2026-11-01");
  const rows = buildDemoFxFallbackRows(now, 3);
  const keys = rows.map((r) => `${r.currency}:${r.rateDate.toISOString().slice(0, 10)}`);
  assert.ok(keys.includes("USD:2026-11-01"));
  assert.ok(keys.includes("EUR:2026-11-01"));
  assert.ok(keys.some((k) => k.startsWith("USD:2026-10-")));
  assert.equal(rows.filter((r) => r.currency === "USD").length, rows.length / 2);
});

let prisma: PrismaClient;

test.before(async () => {
  prisma = await createTestPrisma();
});

test.after(async () => {
  await disconnectTestPrisma(prisma);
});

test.beforeEach(async () => {
  await resetDatabase(prisma);
});

test("seedDemoFxRates forceFallback upserts rates usable for today", async () => {
  const now = utcDateFromYmd("2026-11-01");
  const result = await seedDemoFxRates(prisma, { now, forceFallback: true });
  assert.equal(result.source, "fallback");
  assert.ok(result.upserted > 0);
  const mid = await getMidOnOrBefore(prisma, "USD", now);
  assert.equal(mid.toNumber(), 4);
});

test("seedDemoFxRates falls back when NBP fetch fails", async () => {
  const now = utcDateFromYmd("2026-11-01");
  const result = await seedDemoFxRates(prisma, {
    now,
    fetchImpl: async () => {
      throw new Error("network down");
    },
  });
  assert.equal(result.source, "fallback");
  assert.match(result.warning ?? "", /network down/);
  const mid = await getMidOnOrBefore(prisma, "EUR", now);
  assert.equal(mid.toNumber(), 4.3);
});
