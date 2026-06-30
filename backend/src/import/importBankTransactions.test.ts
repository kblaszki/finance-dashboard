import { test } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { importBankTransactions } from "./importBankTransactions";

const prisma = new PrismaClient();

const SAMPLE_CSV = `#Data operacji;#Opis operacji;#Kwota;
20.01.2026;Test import;50,00`;

test("importBankTransactions dry-run does not persist", async () => {
  const user = await prisma.user.create({
    data: {
      email: `bankimp-${Date.now()}@test.local`,
      username: `bankimp${Date.now()}`,
      passwordHash: "x",
    },
  });
  const account = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BANK",
      name: "Bank Import",
      currency: "PLN",
      cashBalance: 0,
      openingBalance: 0,
    },
  });

  const result = await importBankTransactions(prisma, {
    accountId: account.id,
    userId: user.id,
    bank: "mbank",
    csvText: SAMPLE_CSV,
    dryRun: true,
  });
  assert.equal(result.dryRun, true);
  assert.equal(result.parsed, 1);
  assert.equal(result.imported, 0);

  const txCount = await prisma.transaction.count({ where: { accountId: account.id } });
  assert.equal(txCount, 0);
});

test("importBankTransactions commits and skips duplicates", async () => {
  const user = await prisma.user.create({
    data: {
      email: `bankimp2-${Date.now()}@test.local`,
      username: `bankimp2${Date.now()}`,
      passwordHash: "x",
    },
  });
  const account = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BANK",
      name: "Bank Import 2",
      currency: "PLN",
      cashBalance: 0,
      openingBalance: 0,
    },
  });

  const first = await importBankTransactions(prisma, {
    accountId: account.id,
    userId: user.id,
    bank: "mbank",
    csvText: SAMPLE_CSV,
    dryRun: false,
  });
  assert.equal(first.imported, 1);

  const second = await importBankTransactions(prisma, {
    accountId: account.id,
    userId: user.id,
    bank: "mbank",
    csvText: SAMPLE_CSV,
    dryRun: false,
  });
  assert.equal(second.skipped, 1);
});
