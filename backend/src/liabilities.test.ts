import { test } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import {
  createUserLiability,
  parseLiabilityType,
  sumUserLiabilitiesInCurrency,
} from "./liabilities";

const prisma = new PrismaClient();

test("parseLiabilityType accepts mortgage", () => {
  assert.equal(parseLiabilityType("mortgage"), "mortgage");
  assert.throws(() => parseLiabilityType("unknown"));
});

test("sumUserLiabilitiesInCurrency converts balances", async () => {
  const user = await prisma.user.create({
    data: {
      email: `liab-${Date.now()}@test.local`,
      username: `liabuser${Date.now()}`,
      passwordHash: "x",
    },
  });
  await createUserLiability(prisma, user.id, {
    name: "Loan",
    liabilityType: "loan",
    balance: 1000,
    currency: "PLN",
  });
  const total = await sumUserLiabilitiesInCurrency(prisma, user.id, "PLN", { PLN: 1 });
  assert.equal(total, 1000);
});
