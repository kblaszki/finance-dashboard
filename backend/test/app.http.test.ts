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

test("POST /api/accounts rejects invalid openingBalance", async () => {
  const { token } = await createUserAndToken();
  const res = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountType: "BANK",
      name: "Bad Balance",
      currency: "PLN",
      openingBalance: "not-a-number",
    });
  assert.equal(res.status, 400);
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

test("POST /api/transactions with backdated date recalculates balances", async () => {
  const { token } = await createUserAndToken();
  const accountRes = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountType: "BANK",
      name: "Backdated Bank",
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
  assert.equal(tx1.body.balanceAfter, 1100);

  const tx2 = await request(app)
    .post("/api/transactions")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountId,
      transactionType: "EXPENSE",
      amount: 50,
      currency: "PLN",
      category: "FOOD",
      date: "2025-01-05T12:00:00.000Z",
    });
  assert.equal(tx2.status, 201);
  assert.equal(tx2.body.balanceAfter, 950);

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

test("POST /api/transactions with backdated date on brokerage syncs cash via replay", async () => {
  const { token } = await createUserAndToken();
  const accountRes = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountType: "BROKERAGE",
      name: "Backdated Broker",
      currency: "USD",
      openingBalance: 0,
    });
  const accountId = accountRes.body.id;

  await request(app)
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

  const instrument = await prisma.instrument.create({
    data: { instrumentType: "STOCK", symbol: "BDHTTP", exchange: "TEST", currency: "USD" },
  });

  const holdingRes = await request(app)
    .post(`/api/accounts/${accountId}/holdings`)
    .set("Authorization", `Bearer ${token}`)
    .send({ instrumentId: instrument.id });
  const holdingId = holdingRes.body.id;

  await request(app)
    .post(`/api/holdings/${holdingId}/lots`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      side: "BUY",
      quantity: 5,
      pricePerUnit: 100,
      currency: "USD",
      tradeDate: "2025-01-12T12:00:00.000Z",
    });

  let account = await prisma.account.findUnique({ where: { id: accountId } });
  assert.ok(account);
  assert.equal(Number(account.cashBalance), 500);

  const backdatedFee = await request(app)
    .post("/api/transactions")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountId,
      transactionType: "EXPENSE",
      amount: 50,
      currency: "USD",
      category: "FEE",
      date: "2025-01-08T12:00:00.000Z",
    });
  assert.equal(backdatedFee.status, 201);

  account = await prisma.account.findUnique({ where: { id: accountId } });
  assert.ok(account);
  assert.equal(Number(account.cashBalance), 450);
});

test("POST /api/transactions rejects expense exceeding balance with 400", async () => {
  const { token } = await createUserAndToken();
  const accountRes = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountType: "BANK",
      name: "Low Balance Bank",
      currency: "PLN",
      openingBalance: 100,
    });
  const accountId = accountRes.body.id;

  const res = await request(app)
    .post("/api/transactions")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountId,
      transactionType: "EXPENSE",
      amount: 200,
      currency: "PLN",
      category: "FOOD",
      date: "2025-01-10T12:00:00.000Z",
    });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, "Insufficient cash balance");
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

test("PUT /api/transactions on brokerage with lots syncs cash via replay", async () => {
  const { token } = await createUserAndToken();
  const accountRes = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountType: "BROKERAGE",
      name: "Tx Lot Broker",
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
    data: { instrumentType: "STOCK", symbol: "PUTHTTP", exchange: "TEST", currency: "USD" },
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

  const expense = await request(app)
    .post("/api/transactions")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountId,
      transactionType: "EXPENSE",
      amount: 50,
      currency: "USD",
      category: "FEE",
      date: "2025-01-15T12:00:00.000Z",
    });
  assert.equal(expense.status, 201);

  const moved = await request(app)
    .put(`/api/transactions/${expense.body.id}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ date: "2025-01-08T12:00:00.000Z" });
  assert.equal(moved.status, 200);

  account = await prisma.account.findUnique({ where: { id: accountId } });
  assert.ok(account);
  assert.equal(Number(account.cashBalance), 450);
});

async function createSecondUser(): Promise<{ token: string; userId: number }> {
  const passwordHash = await hashPassword("otherpass123");
  const user = await prisma.user.create({
    data: {
      email: "other@test.local",
      username: "otheruser",
      passwordHash,
    },
  });
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: "other@test.local", password: "otherpass123" });
  assert.equal(res.status, 200);
  return { token: res.body.token, userId: user.id };
}

test("cross-user account access returns 404", async () => {
  const { token: tokenA } = await createUserAndToken();
  const { token: tokenB } = await createSecondUser();

  const accountRes = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${tokenA}`)
    .send({
      accountType: "BANK",
      name: "User A Bank",
      currency: "PLN",
      openingBalance: 100,
    });
  const accountId = accountRes.body.id;

  const getRes = await request(app)
    .get(`/api/accounts/${accountId}`)
    .set("Authorization", `Bearer ${tokenB}`);
  assert.equal(getRes.status, 404);

  const deleteRes = await request(app)
    .delete(`/api/accounts/${accountId}`)
    .set("Authorization", `Bearer ${tokenB}`);
  assert.equal(deleteRes.status, 404);
});

test("cross-user transaction access returns 404", async () => {
  const { token: tokenA } = await createUserAndToken();
  const { token: tokenB } = await createSecondUser();

  const accountRes = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${tokenA}`)
    .send({
      accountType: "BANK",
      name: "User A Tx Bank",
      currency: "PLN",
      openingBalance: 500,
    });
  const accountId = accountRes.body.id;

  const txRes = await request(app)
    .post("/api/transactions")
    .set("Authorization", `Bearer ${tokenA}`)
    .send({
      accountId,
      transactionType: "INCOME",
      amount: 100,
      currency: "PLN",
      category: "SALARY",
      date: "2025-01-10T12:00:00.000Z",
    });
  const txId = txRes.body.id;

  const deleteRes = await request(app)
    .delete(`/api/transactions/${txId}`)
    .set("Authorization", `Bearer ${tokenB}`);
  assert.equal(deleteRes.status, 404);
});

test("cross-user holdings access returns 404", async () => {
  const { token: tokenA } = await createUserAndToken();
  const { token: tokenB } = await createSecondUser();

  const accountRes = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${tokenA}`)
    .send({
      accountType: "BROKERAGE",
      name: "User A Broker",
      currency: "USD",
      openingBalance: 0,
    });
  const accountId = accountRes.body.id;

  await request(app)
    .post("/api/transactions")
    .set("Authorization", `Bearer ${tokenA}`)
    .send({
      accountId,
      transactionType: "TRANSFER_IN",
      amount: 1000,
      currency: "USD",
      category: "FUNDING",
      date: "2025-01-02T12:00:00.000Z",
    });

  const instrument = await prisma.instrument.create({
    data: { instrumentType: "STOCK", symbol: "IDOR", exchange: "TEST", currency: "USD" },
  });

  const holdingRes = await request(app)
    .post(`/api/accounts/${accountId}/holdings`)
    .set("Authorization", `Bearer ${tokenA}`)
    .send({ instrumentId: instrument.id });
  const holdingId = holdingRes.body.id;

  const lotRes = await request(app)
    .post(`/api/holdings/${holdingId}/lots`)
    .set("Authorization", `Bearer ${tokenA}`)
    .send({
      side: "BUY",
      quantity: 5,
      pricePerUnit: 100,
      currency: "USD",
      tradeDate: "2025-01-10T12:00:00.000Z",
    });
  const lotId = lotRes.body.id;

  assert.equal(
    (await request(app).get(`/api/holdings/${holdingId}`).set("Authorization", `Bearer ${tokenB}`)).status,
    404,
  );
  assert.equal(
    (
      await request(app)
        .get(`/api/accounts/${accountId}/holdings`)
        .set("Authorization", `Bearer ${tokenB}`)
    ).status,
    404,
  );
  assert.equal(
    (
      await request(app)
        .get(`/api/holdings/${holdingId}/lots`)
        .set("Authorization", `Bearer ${tokenB}`)
    ).status,
    404,
  );
  assert.equal(
    (
      await request(app)
        .post(`/api/holdings/${holdingId}/lots`)
        .set("Authorization", `Bearer ${tokenB}`)
        .send({
          side: "SELL",
          quantity: 1,
          pricePerUnit: 110,
          currency: "USD",
          tradeDate: "2025-01-12T12:00:00.000Z",
        })
    ).status,
    404,
  );
  assert.equal(
    (
      await request(app)
        .delete(`/api/holding-lots/${lotId}`)
        .set("Authorization", `Bearer ${tokenB}`)
    ).status,
    404,
  );
  assert.equal(
    (
      await request(app)
        .get(`/api/accounts/${accountId}/holdings/${instrument.id}/valuations`)
        .set("Authorization", `Bearer ${tokenB}`)
    ).status,
    404,
  );
});

test("POST /api/auth/register creates user", async () => {
  const res = await request(app).post("/api/auth/register").send({
    email: "newuser@test.local",
    username: "newuser",
    password: "password123",
  });
  assert.equal(res.status, 201);
  assert.ok(res.body.token);
  assert.equal(res.body.user.email, "newuser@test.local");
});

test("POST /api/auth/register rejects short password", async () => {
  const res = await request(app).post("/api/auth/register").send({
    email: "short@test.local",
    username: "short",
    password: "abc",
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /8 characters/);
});

test("POST /api/auth/register rejects duplicate email", async () => {
  await request(app).post("/api/auth/register").send({
    email: "dup@test.local",
    username: "dup1",
    password: "password123",
  });
  const res = await request(app).post("/api/auth/register").send({
    email: "dup@test.local",
    username: "dup2",
    password: "password123",
  });
  assert.equal(res.status, 500);
});

test("POST /api/auth/login rejects wrong password", async () => {
  await request(app).post("/api/auth/register").send({
    email: "loginfail@test.local",
    username: "loginfail",
    password: "password123",
  });
  const res = await request(app).post("/api/auth/login").send({
    email: "loginfail@test.local",
    password: "wrongpassword",
  });
  assert.equal(res.status, 401);
});

test("GET /api/auth/me returns current user", async () => {
  const { token } = await createUserAndToken();
  const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.email, "http@test.local");
});

test("GET /api/instruments lists and searches", async () => {
  const { token } = await createUserAndToken();
  await prisma.instrument.create({
    data: { instrumentType: "STOCK", symbol: "AAPL", name: "Apple Inc", exchange: "NASDAQ", currency: "USD" },
  });
  await prisma.instrument.create({
    data: { instrumentType: "STOCK", symbol: "MSFT", name: "Microsoft", exchange: "NASDAQ", currency: "USD" },
  });

  const all = await request(app).get("/api/instruments").set("Authorization", `Bearer ${token}`);
  assert.equal(all.status, 200);
  assert.ok(all.body.length >= 2);

  const search = await request(app)
    .get("/api/instruments?q=AAPL")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(search.status, 200);
  assert.equal(search.body.length, 1);
  assert.equal(search.body[0].symbol, "AAPL");
});

test("POST /api/instruments creates instrument and rejects missing symbol", async () => {
  const { token } = await createUserAndToken();

  const created = await request(app)
    .post("/api/instruments")
    .set("Authorization", `Bearer ${token}`)
    .send({ symbol: "VT", currency: "USD", instrumentType: "ETF" });
  assert.equal(created.status, 201);
  assert.equal(created.body.symbol, "VT");

  const bad = await request(app)
    .post("/api/instruments")
    .set("Authorization", `Bearer ${token}`)
    .send({ currency: "USD" });
  assert.equal(bad.status, 400);
});

test("GET and POST /api/instruments/:id/valuations", async () => {
  const { token } = await createUserAndToken();
  const instrument = await prisma.instrument.create({
    data: { instrumentType: "STOCK", symbol: "VALHTTP", exchange: "TEST", currency: "USD" },
  });

  const empty = await request(app)
    .get(`/api/instruments/${instrument.id}/valuations?from=2025-01-01&to=2025-01-31`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(empty.status, 200);
  assert.deepEqual(empty.body, []);

  const accountRes = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountType: "BROKERAGE",
      name: "Val Broker",
      currency: "USD",
      openingBalance: 0,
    });
  const accountId = accountRes.body.id;

  await request(app)
    .post("/api/transactions")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountId,
      transactionType: "TRANSFER_IN",
      amount: 5000,
      currency: "USD",
      category: "FUNDING",
      date: "2025-01-01T12:00:00.000Z",
    });

  const holdingRes = await request(app)
    .post(`/api/accounts/${accountId}/holdings`)
    .set("Authorization", `Bearer ${token}`)
    .send({ instrumentId: instrument.id });
  const holdingId = holdingRes.body.id;

  await request(app)
    .post(`/api/holdings/${holdingId}/lots`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      side: "BUY",
      quantity: 10,
      pricePerUnit: 100,
      currency: "USD",
      tradeDate: "2025-01-05T12:00:00.000Z",
    });

  const valRes = await request(app)
    .post(`/api/instruments/${instrument.id}/valuations`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      valuationDate: "2025-01-10T12:00:00.000Z",
      price: 110,
      currency: "USD",
    });
  assert.equal(valRes.status, 201);
  assert.equal(valRes.body.price, 110);

  const listed = await request(app)
    .get(`/api/instruments/${instrument.id}/valuations?from=2025-01-01&to=2025-01-31`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(listed.status, 200);
  assert.equal(listed.body.length, 1);

  const snapshots = await request(app)
    .get(`/api/accounts/${accountId}/valuations?from=2025-01-01&to=2025-01-31`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(snapshots.status, 200);
  assert.ok(snapshots.body.length >= 1);
});

test("GET /api/stats/net-worth sums account values", async () => {
  const { token } = await createUserAndToken();
  await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountType: "BANK",
      name: "NW Bank",
      currency: "PLN",
      openingBalance: 2500,
    });

  const res = await request(app)
    .get("/api/stats/net-worth?currency=PLN")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.currency, "PLN");
  assert.ok(res.body.total >= 2500);
  assert.ok(res.body.byAccountType.BANK >= 2500);
});

test("GET /api/stats/cashflow requires date range", async () => {
  const { token } = await createUserAndToken();
  const missing = await request(app)
    .get("/api/stats/cashflow?currency=PLN")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(missing.status, 400);

  const accountRes = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountType: "BANK",
      name: "CF Bank",
      currency: "PLN",
      openingBalance: 1000,
    });
  const accountId = accountRes.body.id;

  await request(app)
    .post("/api/transactions")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountId,
      transactionType: "INCOME",
      amount: 300,
      currency: "PLN",
      category: "SALARY",
      date: "2025-01-15T12:00:00.000Z",
    });
  await request(app)
    .post("/api/transactions")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountId,
      transactionType: "EXPENSE",
      amount: 100,
      currency: "PLN",
      category: "FOOD",
      date: "2025-01-16T12:00:00.000Z",
    });

  const res = await request(app)
    .get("/api/stats/cashflow?from=2025-01-01&to=2025-01-31&currency=PLN")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.income, 300);
  assert.equal(res.body.expense, 100);
  assert.equal(res.body.net, 200);
});

test("GET /api/stats category breakdowns", async () => {
  const { token } = await createUserAndToken();
  const accountRes = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountType: "BANK",
      name: "Cat Bank",
      currency: "PLN",
      openingBalance: 1000,
    });
  const accountId = accountRes.body.id;

  await request(app)
    .post("/api/transactions")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountId,
      transactionType: "EXPENSE",
      amount: 40,
      currency: "PLN",
      category: "FOOD",
      date: "2025-02-01T12:00:00.000Z",
    });
  await request(app)
    .post("/api/transactions")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountId,
      transactionType: "INCOME",
      amount: 500,
      currency: "PLN",
      category: "SALARY",
      date: "2025-02-05T12:00:00.000Z",
    });

  const expenses = await request(app)
    .get("/api/stats/expenses-by-category?from=2025-02-01&to=2025-02-28&currency=PLN")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(expenses.status, 200);
  assert.deepEqual(expenses.body, [{ category: "FOOD", amount: 40 }]);

  const income = await request(app)
    .get("/api/stats/income-by-category?from=2025-02-01&to=2025-02-28&currency=PLN")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(income.status, 200);
  assert.deepEqual(income.body, [{ category: "SALARY", amount: 500 }]);
});

test("GET /api/market-data/status returns empty counts without holdings", async () => {
  const { token } = await createUserAndToken();
  const res = await request(app)
    .get("/api/market-data/status")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.instrumentCount, 0);
  assert.equal(res.body.lastSyncAt, null);
  assert.equal(res.body.staleCount, 0);
});

test("POST /api/instruments rejects invalid instrumentType", async () => {
  const { token } = await createUserAndToken();
  const res = await request(app)
    .post("/api/instruments")
    .set("Authorization", `Bearer ${token}`)
    .send({
      instrumentType: "CRYPTO",
      symbol: "BTC",
      currency: "USD",
    });
  assert.equal(res.status, 400);
});
