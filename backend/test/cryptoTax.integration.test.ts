import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/auth";
import { computeCryptoTaxSection } from "../src/tax/cryptoTax";
import { findOrCreateHolding } from "../src/holdings";
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

test("computeCryptoTaxSection aggregates crypto sells in tax year", async () => {
  const passwordHash = await hashPassword("testpass123");
  const user = await prisma.user.create({
    data: { email: "crypto-tax@test.local", username: "cryptotax", passwordHash },
  });
  const account = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "CRYPTO",
      name: "BTC wallet",
      currency: "PLN",
      openingBalance: 0,
      cashBalance: 10000,
    },
  });
  const instrument = await prisma.instrument.create({
    data: { instrumentType: "CRYPTO", symbol: "BTC", exchange: null, currency: "PLN" },
  });
  const holding = await findOrCreateHolding(prisma, account.id, instrument.id);
  await prisma.holdingLot.createMany({
    data: [
      {
        holdingId: holding.id,
        side: "BUY",
        quantity: 1,
        quantityAfter: 1,
        pricePerUnit: 100000,
        totalPrice: 100000,
        commission: 0,
        currency: "PLN",
        tradeDate: new Date("2025-01-05T12:00:00.000Z"),
      },
      {
        holdingId: holding.id,
        side: "SELL",
        quantity: 0.5,
        quantityAfter: 0.5,
        pricePerUnit: 120000,
        totalPrice: 60000,
        commission: 0,
        currency: "PLN",
        tradeDate: new Date("2025-06-01T12:00:00.000Z"),
        settlementDate: new Date("2025-06-02T12:00:00.000Z"),
      },
    ],
  });

  const section = await computeCryptoTaxSection(prisma, user.id, 2025, "PLN", MOCK_FX.plnPerUnit);
  assert.equal(section.sellRows.length, 1);
  assert.ok(section.netRealized > 0);
  assert.match(section.message, /PIT scale/i);
});
