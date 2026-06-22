import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/auth";
import { revalueManualAccount } from "../src/manualAccountRevalue";
import {
  backfillAccountValuations,
  recalcTransactionBalances,
  recomputeAccountValuationsFrom,
} from "../src/accountValuation";
import { MOCK_FX } from "./helpers/seedFromFixture";
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

test("revalueManualAccount updates value and valuation snapshots", async () => {
  const passwordHash = await hashPassword("testpass123");
  const user = await prisma.user.create({
    data: { email: "revalue@test.local", username: "revalueuser", passwordHash },
  });
  const account = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "MANUAL",
      name: "Apartment",
      currency: "PLN",
      openingBalance: 500000,
      cashBalance: 500000,
    },
  });
  await backfillAccountValuations(prisma, account.id, MOCK_FX.plnPerUnit);

  const valuationDate = new Date("2025-06-01T12:00:00.000Z");
  await revalueManualAccount(prisma, account, 550000, valuationDate, MOCK_FX.plnPerUnit, {
    recalcTransactionBalances,
    recomputeAccountValuationsFrom,
  });

  const updated = await prisma.account.findUniqueOrThrow({ where: { id: account.id } });
  assert.equal(Number(updated.cashBalance), 550000);

  const txs = await prisma.transaction.findMany({ where: { accountId: account.id } });
  assert.equal(txs.length, 1);
  assert.equal(txs[0].category, "REVALUATION");
  assert.equal(txs[0].transactionType, "INCOME");

  const snaps = await prisma.accountValuationDaily.findMany({
    where: { accountId: account.id },
    orderBy: { valuationDate: "desc" },
  });
  assert.ok(snaps.length > 0);
  assert.equal(Number(snaps[0].totalValue), 550000);
});

test("bond and fund holdings use manual NAV in market sync skip", async () => {
  const passwordHash = await hashPassword("testpass123");
  const user = await prisma.user.create({
    data: { email: "bond@test.local", username: "bonduser", passwordHash },
  });
  const account = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BROKERAGE",
      name: "Broker",
      currency: "PLN",
      openingBalance: 0,
      cashBalance: 0,
    },
  });
  const bond = await prisma.instrument.create({
    data: {
      instrumentType: "BOND",
      symbol: "EDO",
      exchange: null,
      currency: "PLN",
      source: "manual",
    },
  });
  const fund = await prisma.instrument.create({
    data: {
      instrumentType: "FUND",
      symbol: "TBSP",
      exchange: null,
      currency: "PLN",
      source: "manual",
    },
  });
  await prisma.holding.createMany({
    data: [
      { accountId: account.id, instrumentId: bond.id, quantity: 10 },
      { accountId: account.id, instrumentId: fund.id, quantity: 100 },
    ],
  });

  await prisma.instrumentValuation.create({
    data: {
      instrumentId: bond.id,
      valuationDate: new Date("2025-01-10T12:00:00.000Z"),
      price: 98.5,
      currency: "PLN",
      source: "manual_nav",
    },
  });

  const { syncMarketPrices } = await import("../src/marketDataSync");
  const result = await syncMarketPrices(prisma, async () => MOCK_FX, { apiKey: "k" });
  assert.equal(result.synced, 0);
  assert.equal(result.skipped, 2);
  assert.equal(result.errors.length, 0);
});
