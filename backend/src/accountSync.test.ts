import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { hashPassword } from "./auth";
import { runAccountSync, upsertAccountSyncSetting } from "./accountSync";
import { MOCK_FX } from "../test/helpers/seedFromFixture";
import { createTestPrisma, disconnectTestPrisma, resetDatabase } from "../test/prismaTestClient";

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

test("runAccountSync skips unsupported account types", async () => {
  const passwordHash = await hashPassword("testpass123");
  const user = await prisma.user.create({
    data: { email: "sync-skip@test.local", username: "syncskip", passwordHash },
  });
  const account = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "REAL_ESTATE",
      name: "House",
      currency: "PLN",
      openingBalance: 0,
      cashBalance: 0,
    },
  });
  await upsertAccountSyncSetting(prisma, user.id, account.id, { syncEnabled: true });
  const result = await runAccountSync(prisma, user.id, account.id, async () => MOCK_FX);
  assert.equal(result.status, "skipped");
});

test("runAccountSync rejects when sync disabled", async () => {
  const passwordHash = await hashPassword("testpass123");
  const user = await prisma.user.create({
    data: { email: "sync-off@test.local", username: "syncoff", passwordHash },
  });
  const account = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BANK",
      name: "Bank",
      currency: "PLN",
      openingBalance: 0,
      cashBalance: 0,
    },
  });
  await assert.rejects(
    () => runAccountSync(prisma, user.id, account.id, async () => MOCK_FX),
    /Sync is not enabled/,
  );
});
