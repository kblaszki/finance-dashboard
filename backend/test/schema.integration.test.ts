import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { computeQuantityAfter } from "../src/holdingLot";
import { createTestPrisma, disconnectTestPrisma, resetDatabase } from "./prismaTestClient";

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

test("User.email is unique", async () => {
  await prisma.user.create({
    data: { email: "unique@test.local", username: "u1", passwordHash: "x" },
  });
  await assert.rejects(() =>
    prisma.user.create({
      data: { email: "unique@test.local", username: "u2", passwordHash: "x" },
    }),
  );
});

test("Instrument symbol+exchange+source is unique", async () => {
  await prisma.instrument.create({
    data: { instrumentType: "STOCK", symbol: "ABC", exchange: "X", currency: "USD", source: "manual" },
  });
  await assert.rejects(() =>
    prisma.instrument.create({
      data: { instrumentType: "STOCK", symbol: "ABC", exchange: "X", currency: "USD", source: "manual" },
    }),
  );
});

test("delete User cascades to Account", async () => {
  const user = await prisma.user.create({
    data: { email: "cascade@test.local", username: "cascade", passwordHash: "x" },
  });
  await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BANK",
      name: "Cascade",
      currency: "PLN",
      openingBalance: 0,
      cashBalance: 0,
    },
  });
  await prisma.user.delete({ where: { id: user.id } });
  const accounts = await prisma.account.findMany({ where: { userId: user.id } });
  assert.equal(accounts.length, 0);
});

test("computeQuantityAfter rejects SELL over position", () => {
  assert.throws(() => computeQuantityAfter(5, "SELL", 10));
});
