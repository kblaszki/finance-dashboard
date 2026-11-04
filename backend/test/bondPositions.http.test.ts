import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import {
  createUserAndToken as createUserAndTokenHarness,
  registerAndLogin as registerAndLoginHarness,
  resetHttpSuite,
  startHttpSuite,
  stopHttpSuite,
  type HttpSuite,
} from "./httpHarness";

let suite: HttpSuite;
let prisma: PrismaClient;
let app: Express;

test.before(async () => {
  suite = await startHttpSuite();
  prisma = suite.prisma;
  app = suite.app;
});

test.after(async () => {
  await stopHttpSuite(suite);
});

test.beforeEach(async () => {
  await resetHttpSuite(suite);
});

async function createUserAndToken(): Promise<{ token: string; userId: number }> {
  return createUserAndTokenHarness(suite);
}

function sampleBody(overrides: Record<string, unknown> = {}) {
  return {
    seriesCode: "COI0328",
    quantity: 10,
    unitPurchasePrice: 100,
    purchasedAt: "2025-01-01T00:00:00.000Z",
    rateKind: "FIXED",
    currentAnnualRatePct: 6.5,
    couponFrequency: "ANNUAL",
    periodStart: "2025-01-01T00:00:00.000Z",
    maturityDate: "2028-03-01T00:00:00.000Z",
    ...overrides,
  };
}

test("bond positions require TREASURY_BONDS and PLN", async () => {
  const { token } = await createUserAndToken();
  const bank = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Bank", accountType: "BANK", currency: "PLN" });
  assert.equal(bank.status, 201);

  const badType = await request(app)
    .post(`/api/accounts/${bank.body.id}/bond-positions`)
    .set("Authorization", `Bearer ${token}`)
    .send(sampleBody());
  assert.equal(badType.status, 400);

  const treasuryEur = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "Bonds EUR",
      accountType: "TREASURY_BONDS",
      currency: "EUR",
    });
  assert.equal(treasuryEur.status, 201);
  const badCcy = await request(app)
    .post(`/api/accounts/${treasuryEur.body.id}/bond-positions`)
    .set("Authorization", `Bearer ${token}`)
    .send(sampleBody());
  assert.equal(badCcy.status, 400);
});

test("bond positions CRUD + equity holdingsValue uses gross", async () => {
  const { token } = await createUserAndToken();
  const created = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "Obligacje",
      accountType: "TREASURY_BONDS",
      currency: "PLN",
      openingBalance: 500,
    });
  assert.equal(created.status, 201);
  const accountId = created.body.id as number;

  const post = await request(app)
    .post(`/api/accounts/${accountId}/bond-positions`)
    .set("Authorization", `Bearer ${token}`)
    .send(sampleBody({ quantity: 10, currentAnnualRatePct: 0 }));
  assert.equal(post.status, 201);
  assert.equal(post.body.seriesCode, "COI0328");
  assert.equal(post.body.issuer, "SKARB_PANSTWA");
  assert.equal(post.body.valuation.nominalValue, 1000);
  assert.equal(post.body.valuation.grossValue, 1000);
  assert.equal(post.body.valuation.earlyExitFee, 10);
  assert.ok(post.body.valuation.liquidationNet < 1000);

  const list = await request(app)
    .get(`/api/accounts/${accountId}/bond-positions`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(list.status, 200);
  assert.equal(list.body.positions.length, 1);
  assert.equal(list.body.totals.grossValue, 1000);

  const detail = await request(app)
    .get(`/api/accounts/${accountId}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.holdingsValue, 1000);
  assert.equal(detail.body.totalEquity, 1500);

  const patch = await request(app)
    .patch(`/api/accounts/${accountId}/bond-positions/${post.body.id}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ currentAnnualRatePct: 0, quantity: 5 });
  assert.equal(patch.status, 200);
  assert.equal(patch.body.quantity, 5);
  assert.equal(patch.body.valuation.nominalValue, 500);

  const afterPatch = await request(app)
    .get(`/api/accounts/${accountId}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(afterPatch.body.holdingsValue, 500);

  const del = await request(app)
    .delete(`/api/accounts/${accountId}/bond-positions/${post.body.id}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(del.status, 204);

  const empty = await request(app)
    .get(`/api/accounts/${accountId}/bond-positions`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(empty.body.positions.length, 0);
  assert.equal(empty.body.totals.grossValue, 0);
});

test("bond positions IDOR returns 404 for foreign account", async () => {
  const a = await createUserAndToken();
  const bToken = await registerAndLoginHarness(
    suite,
    "other-bonds@test.local",
    "otherbonds",
    "testpass123",
  );
  const account = await prisma.account.create({
    data: {
      userId: a.userId,
      accountType: "TREASURY_BONDS",
      name: "Bonds A",
      currency: "PLN",
      cashBalance: 0,
      openingBalance: 0,
    },
  });
  const res = await request(app)
    .get(`/api/accounts/${account.id}/bond-positions`)
    .set("Authorization", `Bearer ${bToken}`);
  assert.equal(res.status, 404);
});
