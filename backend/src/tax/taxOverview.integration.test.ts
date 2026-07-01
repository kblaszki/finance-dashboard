import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { computeTaxOverview } from "./taxOverview";
import { createPropertySale } from "../propertySales";
import { upsertTaxLossCarryforward } from "./taxLossCarryforward";
import { MOCK_FX } from "../../test/helpers/seedFromFixture";
import { createTestPrisma, disconnectTestPrisma, resetDatabase } from "../../test/prismaTestClient";

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

test("computeTaxOverview aggregates sections for tax year", async () => {
  const user = await prisma.user.create({
    data: { email: "ov@test.local", username: "ov", passwordHash: "x" },
  });
  const reAccount = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "REAL_ESTATE",
      name: "Flat",
      currency: "PLN",
      rentalTaxMethod: "scale",
    },
  });
  await createPropertySale(prisma, user.id, {
    accountId: reAccount.id,
    soldOn: new Date("2025-08-01"),
    proceeds: 500000,
    acquisitionCost: 400000,
    improvementsCost: 10000,
    currency: "PLN",
  });
  await upsertTaxLossCarryforward(prisma, user.id, {
    taxYear: 2024,
    lossAmount: 500,
    usedAmount: 0,
  });
  await prisma.liability.create({
    data: {
      userId: user.id,
      name: "PIT advance",
      liabilityType: "tax_advance",
      balance: 100,
      currency: "PLN",
    },
  });

  const overview = await computeTaxOverview(prisma, user.id, 2025, "PLN", MOCK_FX.plnPerUnit);
  assert.equal(overview.propertySales.totalTaxableGain, 90000);
  assert.equal(overview.taxLiabilities.advancesPaid, 100);
  assert.ok(overview.estimatedTotalTaxDue >= 0);
  assert.equal(overview.pit38.lossCarryforward.rows.length, 1);
});
