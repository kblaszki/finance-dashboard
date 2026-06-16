import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import { assertAccountInvariants } from "./assertAccountInvariants";
import {
  assertFixtureExpected,
  loadFixture,
  seedFromFixture,
} from "./helpers/seedFromFixture";
import { createTestPrisma, disconnectTestPrisma, resetDatabase } from "./prismaTestClient";

const FIXTURES = [
  "golden-bank-month.json",
  "golden-brokerage-multi.json",
  "golden-brokerage-edit-lot.json",
  "golden-manual-real-estate.json",
  "golden-fx-usd.json",
];

let prisma: PrismaClient;

test.before(async () => {
  prisma = await createTestPrisma();
});

test.after(async () => {
  await disconnectTestPrisma(prisma);
});

for (const file of FIXTURES) {
  test(`golden fixture: ${file}`, async () => {
    await resetDatabase(prisma);
    const fixture = loadFixture(file);
    const { accountIds } = await seedFromFixture(prisma, fixture);
    for (const accountId of Object.values(accountIds)) {
      await assertAccountInvariants(prisma, accountId);
    }
    await assertFixtureExpected(prisma, fixture, accountIds);
  });
}
