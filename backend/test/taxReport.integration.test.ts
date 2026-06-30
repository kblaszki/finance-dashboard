import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { computeTaxReport } from "../src/taxReport";
import { findOrCreateHolding, syncHoldingQuantity } from "../src/holdings";
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

test("tax report aggregates FIFO sell in tax year and dividends", async () => {
  const user = await prisma.user.create({
    data: { email: "tax@test.local", username: "taxuser", passwordHash: "x" },
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
  const instrument = await prisma.instrument.create({
    data: { instrumentType: "STOCK", symbol: "AAA", exchange: "GPW", currency: "PLN" },
  });
  const holding = await findOrCreateHolding(prisma, account.id, instrument.id);

  await prisma.holdingLot.create({
    data: {
      holdingId: holding.id,
      side: "BUY",
      quantity: 10,
      quantityAfter: 10,
      totalPrice: 1000,
      pricePerUnit: 100,
      currency: "PLN",
      tradeDate: new Date("2024-06-01T12:00:00.000Z"),
    },
  });
  await prisma.holdingLot.create({
    data: {
      holdingId: holding.id,
      side: "SELL",
      quantity: 4,
      quantityAfter: 6,
      totalPrice: 480,
      pricePerUnit: 120,
      currency: "PLN",
      tradeDate: new Date("2025-04-01T12:00:00.000Z"),
    },
  });
  await syncHoldingQuantity(prisma, holding.id);

  await prisma.transaction.create({
    data: {
      accountId: account.id,
      transactionType: "DIVIDEND",
      amount: 50,
      balanceAfter: 50,
      currency: "PLN",
      category: "DIVIDEND",
      date: new Date("2025-05-01T12:00:00.000Z"),
    },
  });

  const report = await computeTaxReport(prisma, user.id, 2025, "PLN", MOCK_FX.plnPerUnit);

  assert.equal(report.sellRows.length, 1);
  assert.equal(report.sellRows[0].gainLoss, 80);
  assert.equal(report.netRealized, 80);
  assert.equal(report.estimatedBelka, 80 * 0.19);
  assert.equal(report.dividendsGross, 50);
  assert.equal(report.byInstrument[0].symbol, "AAA");
});

test("tax report ignores sells outside selected year", async () => {
  const user = await prisma.user.create({
    data: { email: "taxyear@test.local", username: "taxyear", passwordHash: "x" },
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
  const instrument = await prisma.instrument.create({
    data: { instrumentType: "STOCK", symbol: "BBB", exchange: "GPW", currency: "PLN" },
  });
  const holding = await findOrCreateHolding(prisma, account.id, instrument.id);
  await prisma.holdingLot.create({
    data: {
      holdingId: holding.id,
      side: "BUY",
      quantity: 5,
      quantityAfter: 5,
      totalPrice: 500,
      pricePerUnit: 100,
      currency: "PLN",
      tradeDate: new Date("2023-01-01T12:00:00.000Z"),
    },
  });
  await prisma.holdingLot.create({
    data: {
      holdingId: holding.id,
      side: "SELL",
      quantity: 5,
      quantityAfter: 0,
      totalPrice: 600,
      pricePerUnit: 120,
      currency: "PLN",
      tradeDate: new Date("2023-12-01T12:00:00.000Z"),
    },
  });
  await syncHoldingQuantity(prisma, holding.id);

  const report = await computeTaxReport(prisma, user.id, 2025, "PLN", MOCK_FX.plnPerUnit);
  assert.equal(report.sellRows.length, 0);
  assert.equal(report.netRealized, 0);
});

test("tax report surfaces FIFO errors as warnings instead of silent skip", async () => {
  const user = await prisma.user.create({
    data: { email: "taxwarn@test.local", username: "taxwarn", passwordHash: "x" },
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
  const instrument = await prisma.instrument.create({
    data: { instrumentType: "STOCK", symbol: "BAD", exchange: "GPW", currency: "PLN" },
  });
  const holding = await findOrCreateHolding(prisma, account.id, instrument.id);
  await prisma.holdingLot.create({
    data: {
      holdingId: holding.id,
      side: "SELL",
      quantity: 5,
      quantityAfter: -5,
      totalPrice: 500,
      pricePerUnit: 100,
      currency: "PLN",
      tradeDate: new Date("2025-06-01T12:00:00.000Z"),
    },
  });

  const report = await computeTaxReport(prisma, user.id, 2025, "PLN", MOCK_FX.plnPerUnit);
  assert.equal(report.sellRows.length, 0);
  assert.equal(report.warnings.length, 1);
  assert.equal(report.warnings[0].symbol, "BAD");
  assert.match(report.warnings[0].message, /sell more/i);
});

test("tax report includes belka from income events and pitZg foreign rows", async () => {
  const user = await prisma.user.create({
    data: { email: "tax2@test.local", username: "taxuser2", passwordHash: "x" },
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
  const instrument = await prisma.instrument.create({
    data: {
      instrumentType: "STOCK",
      symbol: "USX",
      exchange: "NYSE",
      currency: "USD",
      pitZgCountry: "US",
    },
  });

  await prisma.incomeEvent.create({
    data: {
      userId: user.id,
      accountId: account.id,
      instrumentId: instrument.id,
      eventType: "interest",
      taxType: "belka",
      amount: 200,
      currency: "PLN",
      occurredOn: new Date("2025-08-01T12:00:00.000Z"),
      withheldTax: 10,
      sourceCountry: "US",
    },
  });
  await prisma.incomeEvent.create({
    data: {
      userId: user.id,
      accountId: account.id,
      instrumentId: instrument.id,
      eventType: "dividend",
      taxType: "pit38",
      amount: 100,
      currency: "PLN",
      occurredOn: new Date("2025-09-01T12:00:00.000Z"),
      sourceCountry: "US",
      foreignTaxPaid: 15,
    },
  });

  const report = await computeTaxReport(prisma, user.id, 2025, "PLN", MOCK_FX.plnPerUnit);
  assert.equal(report.belka.interestGross, 200);
  assert.equal(report.belka.withheldTax, 10);
  assert.equal(report.dividendsGross, 100);
  assert.equal(report.pitZg.length, 1);
  assert.equal(report.pitZg[0].country, "US");
});

test("tax report flags derivative instrument sells", async () => {
  const user = await prisma.user.create({
    data: { email: "tax3@test.local", username: "taxuser3", passwordHash: "x" },
  });
  const account = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BROKERAGE",
      name: "CFD Broker",
      currency: "PLN",
      openingBalance: 0,
      cashBalance: 0,
    },
  });
  const instrument = await prisma.instrument.create({
    data: { instrumentType: "CFD", symbol: "OIL", exchange: null, currency: "PLN" },
  });
  const holding = await findOrCreateHolding(prisma, account.id, instrument.id);
  await prisma.holdingLot.create({
    data: {
      holdingId: holding.id,
      side: "BUY",
      quantity: 1,
      quantityAfter: 1,
      totalPrice: 100,
      pricePerUnit: 100,
      currency: "PLN",
      tradeDate: new Date("2025-01-01T12:00:00.000Z"),
    },
  });
  await prisma.holdingLot.create({
    data: {
      holdingId: holding.id,
      side: "SELL",
      quantity: 1,
      quantityAfter: 0,
      totalPrice: 120,
      pricePerUnit: 120,
      currency: "PLN",
      tradeDate: new Date("2025-07-01T12:00:00.000Z"),
    },
  });
  await syncHoldingQuantity(prisma, holding.id);

  const report = await computeTaxReport(prisma, user.id, 2025, "PLN", MOCK_FX.plnPerUnit);
  assert.equal(report.derivatives.sellCount, 1);
  assert.match(report.derivatives.message, /Derivative/i);
});

test("tax report excludes IKE account without withdrawal in tax year (FR-039)", async () => {
  const user = await prisma.user.create({
    data: { email: "ike@test.local", username: "ikeuser", passwordHash: "x" },
  });
  const account = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BROKERAGE",
      name: "IKE",
      currency: "PLN",
      taxWrapperType: "ike",
      openingBalance: 0,
      cashBalance: 0,
    },
  });
  const instrument = await prisma.instrument.create({
    data: { instrumentType: "STOCK", symbol: "IKE1", exchange: "GPW", currency: "PLN" },
  });
  const holding = await findOrCreateHolding(prisma, account.id, instrument.id);
  await prisma.holdingLot.create({
    data: {
      holdingId: holding.id,
      side: "BUY",
      quantity: 5,
      quantityAfter: 5,
      totalPrice: 500,
      pricePerUnit: 100,
      currency: "PLN",
      tradeDate: new Date("2024-01-01T12:00:00.000Z"),
    },
  });
  await prisma.holdingLot.create({
    data: {
      holdingId: holding.id,
      side: "SELL",
      quantity: 2,
      quantityAfter: 3,
      totalPrice: 240,
      pricePerUnit: 120,
      currency: "PLN",
      tradeDate: new Date("2025-08-01T12:00:00.000Z"),
    },
  });
  await syncHoldingQuantity(prisma, holding.id);

  const excluded = await computeTaxReport(prisma, user.id, 2025, "PLN", MOCK_FX.plnPerUnit);
  assert.equal(excluded.sellRows.length, 0);
  assert.ok(excluded.warnings.some((w) => w.message.includes("excluded from PIT-38")));

  await prisma.taxWrapperWithdrawal.create({
    data: {
      userId: user.id,
      accountId: account.id,
      withdrawnOn: new Date("2025-06-01T12:00:00.000Z"),
      amount: 1000,
      currency: "PLN",
      withdrawalType: "partial",
      includeInPit38: true,
    },
  });

  const included = await computeTaxReport(prisma, user.id, 2025, "PLN", MOCK_FX.plnPerUnit);
  assert.equal(included.sellRows.length, 1);
  assert.equal(included.sellRows[0].gainLoss, 40);
});

test("tax report uses settlement date for tax year (FR-007)", async () => {
  const user = await prisma.user.create({
    data: { email: "settle@test.local", username: "settle", passwordHash: "x" },
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
  const instrument = await prisma.instrument.create({
    data: { instrumentType: "STOCK", symbol: "SET", exchange: "GPW", currency: "PLN" },
  });
  const holding = await findOrCreateHolding(prisma, account.id, instrument.id);
  await prisma.holdingLot.create({
    data: {
      holdingId: holding.id,
      side: "BUY",
      quantity: 1,
      quantityAfter: 1,
      totalPrice: 100,
      pricePerUnit: 100,
      currency: "PLN",
      tradeDate: new Date("2024-01-01T12:00:00.000Z"),
    },
  });
  await prisma.holdingLot.create({
    data: {
      holdingId: holding.id,
      side: "SELL",
      quantity: 1,
      quantityAfter: 0,
      totalPrice: 150,
      pricePerUnit: 150,
      currency: "PLN",
      tradeDate: new Date("2025-12-20T12:00:00.000Z"),
      settlementDate: new Date("2026-01-05T12:00:00.000Z"),
    },
  });
  await syncHoldingQuantity(prisma, holding.id);

  const report2025 = await computeTaxReport(prisma, user.id, 2025, "PLN", MOCK_FX.plnPerUnit);
  assert.equal(report2025.sellRows.length, 0);

  const report2026 = await computeTaxReport(prisma, user.id, 2026, "PLN", MOCK_FX.plnPerUnit);
  assert.equal(report2026.sellRows.length, 1);
  assert.equal(report2026.sellRows[0].gainLoss, 50);
});
