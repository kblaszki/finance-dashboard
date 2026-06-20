import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/auth";
import { createTestPrisma, disconnectTestPrisma, resetDatabase } from "./prismaTestClient";

const JWT_SECRET = "test-jwt-secret-must-be-at-least-32-characters";

let prisma: PrismaClient;
let app: Express;

test.before(async () => {
  process.env.JWT_SECRET = JWT_SECRET;
  prisma = await createTestPrisma();
  const mod = await import("../src/app");
  app = mod.app;
});

test.after(async () => {
  await disconnectTestPrisma(prisma);
});

test.beforeEach(async () => {
  await resetDatabase(prisma);
});

async function createUserAndToken(): Promise<{ token: string; userId: number }> {
  const passwordHash = await hashPassword("testpass123");
  const user = await prisma.user.create({
    data: {
      email: "http@test.local",
      username: "httptest",
      passwordHash,
    },
  });
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: "http@test.local", password: "testpass123" });
  assert.equal(res.status, 200);
  return { token: res.body.token, userId: user.id };
}

test("GET /api/accounts returns 401 without token", async () => {
  const res = await request(app).get("/api/accounts");
  assert.equal(res.status, 401);
});

test("POST /api/accounts creates account", async () => {
  const { token } = await createUserAndToken();
  const res = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountType: "BANK",
      name: "Test Bank",
      currency: "PLN",
      openingBalance: 1000,
    });
  assert.equal(res.status, 201);
  assert.equal(res.body.name, "Test Bank");
  assert.equal(res.body.cashBalance, 1000);
});

test("POST /api/transactions updates balanceAfter", async () => {
  const { token } = await createUserAndToken();
  const accountRes = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountType: "BANK",
      name: "Tx Bank",
      currency: "PLN",
      openingBalance: 500,
    });
  const accountId = accountRes.body.id;

  const txRes = await request(app)
    .post("/api/transactions")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountId,
      transactionType: "INCOME",
      amount: 200,
      currency: "PLN",
      category: "SALARY",
      date: "2025-01-15T12:00:00.000Z",
    });
  assert.equal(txRes.status, 201);
  assert.equal(txRes.body.balanceAfter, 700);
});

test("POST holding lot rejects oversell", async () => {
  const { token } = await createUserAndToken();
  const accountRes = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountType: "BROKERAGE",
      name: "Broker",
      currency: "USD",
      openingBalance: 0,
    });
  const accountId = accountRes.body.id;

  const instrument = await prisma.instrument.create({
    data: { instrumentType: "STOCK", symbol: "HTTP", exchange: "TEST", currency: "USD" },
  });

  const holdingRes = await request(app)
    .post(`/api/accounts/${accountId}/holdings`)
    .set("Authorization", `Bearer ${token}`)
    .send({ instrumentId: instrument.id });
  assert.equal(holdingRes.status, 201);
  const holdingId = holdingRes.body.id;

  await request(app)
    .post(`/api/holdings/${holdingId}/lots`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      side: "BUY",
      quantity: 5,
      pricePerUnit: 100,
      currency: "USD",
      tradeDate: "2025-01-10T12:00:00.000Z",
    });

  const sellRes = await request(app)
    .post(`/api/holdings/${holdingId}/lots`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      side: "SELL",
      quantity: 10,
      pricePerUnit: 110,
      currency: "USD",
      tradeDate: "2025-01-12T12:00:00.000Z",
    });
  assert.equal(sellRes.status, 400);
});

test("GET /api/accounts/:id/valuations returns snapshots", async () => {
  const { token } = await createUserAndToken();
  const accountRes = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountType: "BANK",
      name: "Chart Bank",
      currency: "PLN",
      openingBalance: 2000,
    });
  const accountId = accountRes.body.id;

  const res = await request(app)
    .get(`/api/accounts/${accountId}/valuations`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body));
  assert.ok(res.body.length >= 1);
});

test("PUT /api/transactions recalculates balances when moving a transaction earlier", async () => {
  const { token } = await createUserAndToken();
  const accountRes = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountType: "BANK",
      name: "Move Tx Bank",
      currency: "PLN",
      openingBalance: 1000,
    });
  const accountId = accountRes.body.id;

  const tx1 = await request(app)
    .post("/api/transactions")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountId,
      transactionType: "INCOME",
      amount: 100,
      currency: "PLN",
      category: "SALARY",
      date: "2025-01-10T12:00:00.000Z",
    });
  assert.equal(tx1.status, 201);

  const tx2 = await request(app)
    .post("/api/transactions")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountId,
      transactionType: "EXPENSE",
      amount: 50,
      currency: "PLN",
      category: "FOOD",
      date: "2025-01-12T12:00:00.000Z",
    });
  assert.equal(tx2.status, 201);
  assert.equal(tx2.body.balanceAfter, 1050);

  const moved = await request(app)
    .put(`/api/transactions/${tx2.body.id}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ date: "2025-01-05T12:00:00.000Z" });
  assert.equal(moved.status, 200);

  const rows = await prisma.transaction.findMany({
    where: { accountId },
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });
  assert.equal(rows.length, 2);
  assert.equal(Number(rows[0].balanceAfter), 950);
  assert.equal(Number(rows[1].balanceAfter), 1050);

  const account = await prisma.account.findUnique({ where: { id: accountId } });
  assert.ok(account);
  assert.equal(Number(account.cashBalance), 1050);
});

test("DELETE /api/holding-lots/:id restores brokerage cash balance", async () => {
  const { token } = await createUserAndToken();
  const accountRes = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountType: "BROKERAGE",
      name: "Delete Lot Broker",
      currency: "USD",
      openingBalance: 0,
    });
  const accountId = accountRes.body.id;

  const funding = await request(app)
    .post("/api/transactions")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountId,
      transactionType: "TRANSFER_IN",
      amount: 1000,
      currency: "USD",
      category: "FUNDING",
      date: "2025-01-02T12:00:00.000Z",
    });
  assert.equal(funding.status, 201);

  const instrument = await prisma.instrument.create({
    data: { instrumentType: "STOCK", symbol: "DELHTTP", exchange: "TEST", currency: "USD" },
  });

  const holdingRes = await request(app)
    .post(`/api/accounts/${accountId}/holdings`)
    .set("Authorization", `Bearer ${token}`)
    .send({ instrumentId: instrument.id });
  assert.equal(holdingRes.status, 201);
  const holdingId = holdingRes.body.id;

  const buyRes = await request(app)
    .post(`/api/holdings/${holdingId}/lots`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      side: "BUY",
      quantity: 5,
      pricePerUnit: 100,
      currency: "USD",
      tradeDate: "2025-01-10T12:00:00.000Z",
    });
  assert.equal(buyRes.status, 201);

  let account = await prisma.account.findUnique({ where: { id: accountId } });
  assert.ok(account);
  assert.equal(Number(account.cashBalance), 500);

  const deleted = await request(app)
    .delete(`/api/holding-lots/${buyRes.body.id}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(deleted.status, 204);

  account = await prisma.account.findUnique({ where: { id: accountId } });
  assert.ok(account);
  assert.equal(Number(account.cashBalance), 1000);
});
