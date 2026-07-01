import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { hashPassword } from "./auth";
import { findOrCreateHolding } from "./holdings";
import { simulatePreSellTax } from "./preSellSimulator";
import { upsertTaxLossCarryforward } from "./taxLossCarryforward";
import { createTaxWrapperWithdrawal } from "./taxWrapper";
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

async function seedBrokerHolding(
  prisma: PrismaClient,
  opts: { accountType?: string; instrumentType?: string; taxWrapperType?: string | null },
) {
  const passwordHash = await hashPassword("testpass123");
  const user = await prisma.user.create({
    data: { email: `presell-${opts.taxWrapperType ?? "std"}@test.local`, username: `ps${Date.now()}`, passwordHash },
  });
  const account = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: opts.accountType ?? "BROKERAGE",
      name: "Account",
      currency: "PLN",
      openingBalance: 10000,
      cashBalance: 10000,
      taxWrapperType: opts.taxWrapperType ?? "standard",
    },
  });
  const instrument = await prisma.instrument.create({
    data: {
      instrumentType: opts.instrumentType ?? "STOCK",
      symbol: "SIM",
      exchange: "TEST",
      currency: "PLN",
    },
  });
  const holding = await findOrCreateHolding(prisma, account.id, instrument.id);
  await prisma.holdingLot.create({
    data: {
      holdingId: holding.id,
      side: "BUY",
      quantity: 10,
      quantityAfter: 10,
      pricePerUnit: 100,
      totalPrice: 1000,
      commission: 0,
      currency: "PLN",
      tradeDate: new Date("2025-01-10T12:00:00.000Z"),
    },
  });
  return { user, account, holding };
}

test("simulatePreSellTax excludes IKE wrapper without qualifying withdrawal", async () => {
  const { user, holding } = await seedBrokerHolding(prisma, { taxWrapperType: "ike" });
  const result = await simulatePreSellTax(
    prisma,
    user.id,
    { holdingId: holding.id, quantity: 2, salePricePerUnit: 120 },
    "PLN",
    MOCK_FX.plnPerUnit,
  );
  assert.equal(result.taxRegime, "excluded_wrapper");
  assert.equal(result.pit38TaxableAfterLosses, null);
});

test("simulatePreSellTax applies loss carryforward for brokerage", async () => {
  const { user, holding } = await seedBrokerHolding(prisma, {});
  await upsertTaxLossCarryforward(prisma, user.id, { taxYear: 2024, lossAmount: 500 });
  const result = await simulatePreSellTax(
    prisma,
    user.id,
    { holdingId: holding.id, quantity: 2, salePricePerUnit: 120, saleDate: new Date("2025-06-01T12:00:00.000Z") },
    "PLN",
    MOCK_FX.plnPerUnit,
  );
  assert.equal(result.taxRegime, "pit38");
  assert.equal(result.gainLoss, 40);
  assert.equal(result.pit38TaxableAfterLosses, 0);
});

test("simulatePreSellTax uses crypto regime for CRYPTO account", async () => {
  const { user, holding } = await seedBrokerHolding(prisma, {
    accountType: "CRYPTO",
    instrumentType: "CRYPTO",
  });
  const result = await simulatePreSellTax(
    prisma,
    user.id,
    { holdingId: holding.id, quantity: 1, salePricePerUnit: 150 },
    "PLN",
    MOCK_FX.plnPerUnit,
  );
  assert.equal(result.taxRegime, "crypto_pit");
  assert.equal(result.pit38TaxableAfterLosses, null);
  assert.match(result.message, /crypto/i);
});

test("simulatePreSellTax includes IKE after qualifying withdrawal", async () => {
  const { user, account, holding } = await seedBrokerHolding(prisma, { taxWrapperType: "ike" });
  await createTaxWrapperWithdrawal(prisma, user.id, {
    accountId: account.id,
    withdrawnOn: new Date("2025-03-01T12:00:00.000Z"),
    amount: 100,
    currency: "PLN",
    withdrawalType: "partial",
    includeInPit38: true,
  });
  const result = await simulatePreSellTax(
    prisma,
    user.id,
    { holdingId: holding.id, quantity: 1, salePricePerUnit: 130, saleDate: new Date("2025-06-01T12:00:00.000Z") },
    "PLN",
    MOCK_FX.plnPerUnit,
  );
  assert.equal(result.taxRegime, "pit38");
  assert.ok(result.pit38TaxableAfterLosses != null);
});
