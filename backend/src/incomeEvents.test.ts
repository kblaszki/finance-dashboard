import { test } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import {
  createUserIncomeEvent,
  defaultTaxTypeForEvent,
  deleteUserIncomeEvent,
  isBelkaIncomeEvent,
  parseIncomeEventType,
  parseIncomeTaxType,
  updateUserIncomeEvent,
} from "./incomeEvents";

const prisma = new PrismaClient();

test("parseIncomeEventType accepts known types", () => {
  assert.equal(parseIncomeEventType("dividend"), "dividend");
  assert.throws(() => parseIncomeEventType("salary"));
});

test("defaultTaxTypeForEvent maps interest to belka", () => {
  assert.equal(defaultTaxTypeForEvent("interest"), "belka");
  assert.equal(defaultTaxTypeForEvent("dividend"), "pit38");
});

test("isBelkaIncomeEvent respects taxType override", () => {
  assert.equal(isBelkaIncomeEvent("interest", "belka"), true);
  assert.equal(isBelkaIncomeEvent("interest", "exempt"), false);
});

test("parseIncomeTaxType rejects unknown values", () => {
  assert.throws(() => parseIncomeTaxType("vat"));
});

test("createUserIncomeEvent rejects invalid account", async () => {
  const user = await prisma.user.create({
    data: {
      email: `inc3-${Date.now()}@test.local`,
      username: `incuser3${Date.now()}`,
      passwordHash: "x",
    },
  });
  await assert.rejects(() =>
    createUserIncomeEvent(prisma, user.id, {
      accountId: 999999,
      eventType: "interest",
      amount: 10,
      currency: "PLN",
      occurredOn: new Date("2026-01-01T12:00:00.000Z"),
    }),
  );
});

test("createUserIncomeEvent persists row", async () => {
  const user = await prisma.user.create({
    data: {
      email: `inc-${Date.now()}@test.local`,
      username: `incuser${Date.now()}`,
      passwordHash: "x",
    },
  });
  const account = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BANK",
      name: "Bank",
      currency: "PLN",
      cashBalance: 0,
    },
  });
  const row = await createUserIncomeEvent(prisma, user.id, {
    accountId: account.id,
    eventType: "interest",
    amount: 50,
    currency: "PLN",
    occurredOn: new Date("2026-03-01T12:00:00.000Z"),
  });
  assert.equal(row.eventType, "interest");
  assert.equal(row.taxType, "belka");
});

test("update and delete income event", async () => {
  const user = await prisma.user.create({
    data: {
      email: `inc2-${Date.now()}@test.local`,
      username: `incuser2${Date.now()}`,
      passwordHash: "x",
    },
  });
  const account = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BANK",
      name: "Bank2",
      currency: "PLN",
      cashBalance: 0,
    },
  });
  const created = await createUserIncomeEvent(prisma, user.id, {
    accountId: account.id,
    eventType: "coupon",
    amount: 30,
    currency: "PLN",
    occurredOn: new Date("2026-04-01T12:00:00.000Z"),
  });
  const updated = await updateUserIncomeEvent(prisma, user.id, created.id, { amount: 35 });
  assert.equal(Number(updated.amount), 35);
  await deleteUserIncomeEvent(prisma, user.id, created.id);
  const gone = await prisma.incomeEvent.findUnique({ where: { id: created.id } });
  assert.equal(gone, null);
});
