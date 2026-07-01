import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/auth";
import { createAssetValuation } from "../src/assetValuations";
import { createCouponSchedule, recordCouponScheduleAsIncome } from "../src/couponSchedules";
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

test("createAssetValuation updates account balance and stores timeline (DATA-024)", async () => {
  const passwordHash = await hashPassword("testpass123");
  const user = await prisma.user.create({
    data: { email: "av@test.local", username: "avuser", passwordHash },
  });
  const account = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "REAL_ESTATE",
      name: "Flat",
      currency: "PLN",
      openingBalance: 500000,
      cashBalance: 500000,
    },
  });

  const valuedOn = new Date("2025-08-01T12:00:00.000Z");
  await createAssetValuation(
    prisma,
    user.id,
    {
      accountId: account.id,
      valuedOn,
      value: 520000,
      currency: "PLN",
      description: "Appraisal",
    },
    MOCK_FX.plnPerUnit,
  );

  const rows = await prisma.assetValuation.findMany({ where: { userId: user.id } });
  assert.equal(rows.length, 1);
  assert.equal(Number(rows[0].value), 520000);

  const updated = await prisma.account.findUniqueOrThrow({ where: { id: account.id } });
  assert.equal(Number(updated.cashBalance), 520000);
});

test("coupon schedule records income event (FR-033)", async () => {
  const passwordHash = await hashPassword("testpass123");
  const user = await prisma.user.create({
    data: { email: "coupon@test.local", username: "couponuser", passwordHash },
  });
  const account = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BROKERAGE",
      name: "Broker",
      currency: "PLN",
      openingBalance: 10000,
      cashBalance: 10000,
    },
  });
  const instrument = await prisma.instrument.create({
    data: {
      instrumentType: "BOND",
      symbol: "EDO",
      exchange: null,
      currency: "PLN",
      source: "manual",
    },
  });
  const holding = await prisma.holding.create({
    data: { accountId: account.id, instrumentId: instrument.id, quantity: 10 },
  });
  await prisma.holdingLot.create({
    data: {
      holdingId: holding.id,
      side: "BUY",
      quantity: 10,
      quantityAfter: 10,
      pricePerUnit: 100,
      totalPrice: 1000,
      currency: "PLN",
      tradeDate: new Date("2025-01-05T12:00:00.000Z"),
    },
  });

  const schedule = await createCouponSchedule(prisma, user.id, {
    accountId: account.id,
    instrumentId: instrument.id,
    scheduleType: "coupon",
    paymentOn: new Date("2025-06-15T12:00:00.000Z"),
    amount: 120,
    currency: "PLN",
  });
  assert.equal(schedule.incomeEventId, null);

  const recorded = await recordCouponScheduleAsIncome(prisma, user.id, schedule.id);
  assert.ok(recorded.incomeEventId);

  const income = await prisma.incomeEvent.findFirst({ where: { userId: user.id } });
  assert.equal(income?.eventType, "coupon");
  assert.equal(Number(income?.amount), 120);
});
