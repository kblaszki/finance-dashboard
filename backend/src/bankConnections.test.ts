import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { hashPassword } from "./auth";
import { createBankConnection } from "./bankConnections";
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

test("createBankConnection requires BANK account type", async () => {
  const passwordHash = await hashPassword("testpass123");
  const user = await prisma.user.create({
    data: { email: "bankconn@test.local", username: "bankconn", passwordHash },
  });
  const broker = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BROKERAGE",
      name: "Broker",
      currency: "PLN",
      openingBalance: 0,
      cashBalance: 0,
    },
  });
  await assert.rejects(
    () => createBankConnection(prisma, user.id, { accountId: broker.id, bankCode: "MBANK" }),
    /PSD2 connections require a BANK account/,
  );
});
