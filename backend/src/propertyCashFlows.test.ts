import { test } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { createPropertyCashFlow, parsePropertyFlowType } from "./propertyCashFlows";

const prisma = new PrismaClient();

test("parsePropertyFlowType accepts rent", () => {
  assert.equal(parsePropertyFlowType("rent"), "rent");
  assert.throws(() => parsePropertyFlowType("sale"));
});

test("createPropertyCashFlow requires REAL_ESTATE account", async () => {
  const user = await prisma.user.create({
    data: {
      email: `prop-${Date.now()}@test.local`,
      username: `propuser${Date.now()}`,
      passwordHash: "x",
    },
  });
  const re = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "REAL_ESTATE",
      name: "Flat",
      currency: "PLN",
      cashBalance: 500000,
    },
  });
  const bank = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: "BANK",
      name: "Bank",
      currency: "PLN",
      cashBalance: 0,
    },
  });

  const row = await createPropertyCashFlow(prisma, user.id, {
    accountId: re.id,
    flowType: "rent",
    amount: 2500,
    currency: "PLN",
    occurredOn: new Date("2026-05-01T12:00:00.000Z"),
  });
  assert.equal(row.flowType, "rent");

  await assert.rejects(() =>
    createPropertyCashFlow(prisma, user.id, {
      accountId: bank.id,
      flowType: "rent",
      amount: 100,
      currency: "PLN",
      occurredOn: new Date("2026-05-01T12:00:00.000Z"),
    }),
  );
});
