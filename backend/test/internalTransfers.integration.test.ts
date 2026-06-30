import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import {
  createInternalTransfer,
  deleteInternalTransfer,
  suggestCrossCurrencyTransfer,
} from "../src/internalTransfers";
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

const MOCK_FX = { PLN: 1, USD: 4, EUR: 4.3 };

async function getAccountForUser(_db: PrismaClient, userId: number, accountId: number) {
  const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
  if (!account) return null;
  return { id: account.id, currency: account.currency, name: account.name };
}

test("createInternalTransfer moves cash between accounts", async () => {
  const user = await prisma.user.create({
    data: { email: "xfer@test.local", username: "xferuser", passwordHash: "x" },
  });
  const from = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BANK",
      name: "From",
      currency: "PLN",
      openingBalance: 1000,
      cashBalance: 1000,
    },
  });
  const to = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BANK",
      name: "To",
      currency: "PLN",
      openingBalance: 0,
      cashBalance: 0,
    },
  });

  const transfer = await createInternalTransfer(
    prisma,
    user.id,
    {
      fromAccountId: from.id,
      toAccountId: to.id,
      fromAmount: 200,
      toAmount: 200,
      date: new Date("2025-05-01T12:00:00.000Z"),
    },
    { getAccountForUser, getFxRatesPlnPerUnit: async () => ({ plnPerUnit: MOCK_FX }) },
  );

  assert.equal(transfer.fromAmount, 200);
  const fromAfter = await prisma.account.findUniqueOrThrow({ where: { id: from.id } });
  const toAfter = await prisma.account.findUniqueOrThrow({ where: { id: to.id } });
  assert.equal(Number(fromAfter.cashBalance), 800);
  assert.equal(Number(toAfter.cashBalance), 200);
});

test("deleteInternalTransfer removes both legs", async () => {
  const user = await prisma.user.create({
    data: { email: "delxfer@test.local", username: "delxfer", passwordHash: "x" },
  });
  const from = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BANK",
      name: "From",
      currency: "PLN",
      openingBalance: 500,
      cashBalance: 500,
    },
  });
  const to = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BANK",
      name: "To",
      currency: "PLN",
      openingBalance: 0,
      cashBalance: 0,
    },
  });

  const created = await createInternalTransfer(
    prisma,
    user.id,
    {
      fromAccountId: from.id,
      toAccountId: to.id,
      fromAmount: 100,
      toAmount: 100,
      date: new Date("2025-05-02T12:00:00.000Z"),
    },
    { getAccountForUser, getFxRatesPlnPerUnit: async () => ({ plnPerUnit: MOCK_FX }) },
  );

  await deleteInternalTransfer(prisma, user.id, created.groupId, {
    getFxRatesPlnPerUnit: async () => ({ plnPerUnit: MOCK_FX }),
  });

  const txCount = await prisma.transaction.count({
    where: { category: "INTERNAL_TRANSFER" },
  });
  assert.equal(txCount, 0);
});

test("suggestCrossCurrencyTransfer uses FX table", () => {
  const suggestion = suggestCrossCurrencyTransfer("USD", "PLN", 100, MOCK_FX);
  assert.equal(suggestion.exchangeRate, 4);
  assert.equal(suggestion.suggestedToAmount, 400);
});
