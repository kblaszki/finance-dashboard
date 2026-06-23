import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PrismaClient } from "@prisma/client";
import { importBrokerTrades } from "../src/import/importTrades";
import { MOCK_FX } from "./helpers/seedFromFixture";
import { createTestPrisma, disconnectTestPrisma, resetDatabase } from "./prismaTestClient";

const FIXTURES = join(__dirname, "fixtures", "import");

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

async function createBrokerageAccount(userId: number) {
  return prisma.account.create({
    data: {
      userId,
      accountType: "BROKERAGE",
      name: "XTB",
      currency: "PLN",
      openingBalance: 0,
      cashBalance: 0,
    },
  });
}

test("import closed positions creates holdings and lots", async () => {
  const user = await prisma.user.create({
    data: { email: "import@test.local", username: "importuser", passwordHash: "x" },
  });
  const account = await createBrokerageAccount(user.id);
  const csv = readFileSync(join(FIXTURES, "xtb-closed-positions.csv"), "utf8");

  const first = await importBrokerTrades(prisma, {
    accountId: account.id,
    userId: user.id,
    broker: "xtb",
    csvText: csv,
    dryRun: false,
    plnPerUnit: MOCK_FX.plnPerUnit,
  });
  assert.equal(first.imported, 3);
  assert.equal(first.skipped, 0);

  const pko = await prisma.instrument.findFirst({ where: { symbol: "PKO" } });
  assert.ok(pko);
  const pkoHolding = await prisma.holding.findFirst({
    where: { accountId: account.id, instrumentId: pko!.id },
  });
  assert.ok(pkoHolding);
  assert.equal(Number(pkoHolding!.quantity), 10);

  const cdr = await prisma.instrument.findFirst({ where: { symbol: "CDR" } });
  assert.ok(cdr);
  const cdrHolding = await prisma.holding.findFirst({
    where: { accountId: account.id, instrumentId: cdr!.id },
  });
  assert.ok(cdrHolding);
  assert.equal(Number(cdrHolding!.quantity), 3);

  const second = await importBrokerTrades(prisma, {
    accountId: account.id,
    userId: user.id,
    broker: "xtb",
    csvText: csv,
    dryRun: false,
    plnPerUnit: MOCK_FX.plnPerUnit,
  });
  assert.equal(second.imported, 0);
  assert.equal(second.skipped, 3);
});

test("import cash operations creates transactions", async () => {
  const user = await prisma.user.create({
    data: { email: "cash-import@test.local", username: "cashimport", passwordHash: "x" },
  });
  const account = await createBrokerageAccount(user.id);
  const csv = readFileSync(join(FIXTURES, "xtb-cash-operations.csv"), "utf8");

  const result = await importBrokerTrades(prisma, {
    accountId: account.id,
    userId: user.id,
    broker: "xtb",
    csvText: csv,
    dryRun: false,
    plnPerUnit: MOCK_FX.plnPerUnit,
  });
  assert.equal(result.imported, 4);

  const txs = await prisma.transaction.findMany({ where: { accountId: account.id } });
  assert.equal(txs.length, 4);
  assert.ok(txs.some((t) => t.transactionType === "DIVIDEND"));
  assert.ok(txs.some((t) => t.transactionType === "INTEREST"));
});

test("dry run does not persist rows", async () => {
  const user = await prisma.user.create({
    data: { email: "dry@test.local", username: "dryuser", passwordHash: "x" },
  });
  const account = await createBrokerageAccount(user.id);
  const csv = readFileSync(join(FIXTURES, "xtb-closed-positions.csv"), "utf8");

  const result = await importBrokerTrades(prisma, {
    accountId: account.id,
    userId: user.id,
    broker: "xtb",
    csvText: csv,
    dryRun: true,
    plnPerUnit: MOCK_FX.plnPerUnit,
  });
  assert.equal(result.dryRun, true);
  assert.equal(result.parsed, 3);
  assert.equal(result.imported, 0);
  assert.ok(result.preview?.length === 3);

  const lots = await prisma.holdingLot.count();
  assert.equal(lots, 0);
});
