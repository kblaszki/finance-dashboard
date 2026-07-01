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

async function registerAndLogin(
  email: string,
  username: string,
  password: string,
): Promise<string> {
  const reg = await request(app).post("/api/auth/register").send({ email, username, password });
  assert.equal(reg.status, 201);
  return reg.body.token as string;
}

test("GET /api/accounts returns 401 without token", async () => {
  const res = await request(app).get("/api/accounts");
  assert.equal(res.status, 401);
});

test("GET /api/accounts/:id rejects non-numeric id", async () => {
  const { token } = await createUserAndToken();
  const res = await request(app)
    .get("/api/accounts/foo")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 400);
  assert.match(res.body.error, /id must be a valid number/i);
});

test("GET /api/health returns ok", async () => {
  const res = await request(app).get("/api/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.db, true);
});

test("GET /api/auth/config returns allowRegister", async () => {
  const res = await request(app).get("/api/auth/config");
  assert.equal(res.status, 200);
  assert.equal(typeof res.body.allowRegister, "boolean");
});

test("POST /api/auth/register returns 403 when ALLOW_REGISTER=false", async () => {
  const prev = process.env.ALLOW_REGISTER;
  process.env.ALLOW_REGISTER = "false";
  try {
    const res = await request(app).post("/api/auth/register").send({
      email: "blocked@test.local",
      username: "blocked",
      password: "testpass123",
    });
    assert.equal(res.status, 403);
  } finally {
    if (prev === undefined) delete process.env.ALLOW_REGISTER;
    else process.env.ALLOW_REGISTER = prev;
  }
});

test("GET /api/accounts returns totalBalance per account", async () => {
  const { token } = await createUserAndToken();
  await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountType: "BANK",
      name: "Balance List Bank",
      currency: "PLN",
      openingBalance: 2500,
    });

  const res = await request(app)
    .get("/api/accounts")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body));
  const row = res.body.find((a: { name: string }) => a.name === "Balance List Bank");
  assert.ok(row);
  assert.equal(row.totalBalance, 2500);
  assert.equal(row.cashBalance, 2500);
});

test("GET /api/accounts/:id returns totalBalance", async () => {
  const { token } = await createUserAndToken();
  const accountRes = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountType: "BANK",
      name: "Detail Balance Bank",
      currency: "PLN",
      openingBalance: 1800,
    });
  const accountId = accountRes.body.id;

  const res = await request(app)
    .get(`/api/accounts/${accountId}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.totalBalance, 1800);
  assert.equal(res.body.cashBalance, 1800);
});

test("PUT /api/accounts/:id returns totalBalance after rename", async () => {
  const { token } = await createUserAndToken();
  const accountRes = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountType: "BANK",
      name: "Rename Me",
      currency: "PLN",
      openingBalance: 500,
    });
  const accountId = accountRes.body.id;

  const res = await request(app)
    .put(`/api/accounts/${accountId}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Renamed Bank" });
  assert.equal(res.status, 200);
  assert.equal(res.body.name, "Renamed Bank");
  assert.equal(res.body.totalBalance, 500);
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

test("POST /api/accounts accepts extended account types (FR-006)", async () => {
  const { token } = await createUserAndToken();
  for (const accountType of ["CRYPTO", "REAL_ESTATE", "PRECIOUS_METAL", "OTHER"]) {
    const res = await request(app)
      .post("/api/accounts")
      .set("Authorization", `Bearer ${token}`)
      .send({
        accountType,
        name: `${accountType} account`,
        currency: "PLN",
        openingBalance: 0,
      });
    assert.equal(res.status, 201, accountType);
    assert.equal(res.body.accountType, accountType);
  }
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

test("POST /api/auth/login accepts username identifier", async () => {
  await request(app).post("/api/auth/register").send({
    email: "userlogin@test.local",
    username: "MyUser99",
    password: "password123",
  });
  const res = await request(app).post("/api/auth/login").send({
    login: "myuser99",
    password: "password123",
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.user.username, "MyUser99");
});

test("POST /api/auth/login requires identifier", async () => {
  const res = await request(app).post("/api/auth/login").send({ password: "password123" });
  assert.equal(res.status, 400);
});

test("PATCH /api/auth/profile rejects invalid username", async () => {
  const token = await registerAndLogin("badname@test.local", "badnameuser", "password123");
  const res = await request(app)
    .patch("/api/auth/profile")
    .set("Authorization", `Bearer ${token}`)
    .send({ username: "x" });
  assert.equal(res.status, 400);
});

test("PATCH /api/auth/password rejects short new password", async () => {
  const token = await registerAndLogin("shortpwd@test.local", "shortpwduser", "password123");
  const res = await request(app)
    .patch("/api/auth/password")
    .set("Authorization", `Bearer ${token}`)
    .send({ currentPassword: "password123", newPassword: "short" });
  assert.equal(res.status, 400);
});

test("PATCH /api/auth/profile updates username", async () => {
  const token = await registerAndLogin("profile@test.local", "profileuser", "password123");
  const res = await request(app)
    .patch("/api/auth/profile")
    .set("Authorization", `Bearer ${token}`)
    .send({ username: "renamed_user" });
  assert.equal(res.status, 200);
  assert.equal(res.body.username, "renamed_user");
});

test("PATCH /api/auth/password requires current password", async () => {
  const token = await registerAndLogin("pwd@test.local", "pwduser", "password123");
  const bad = await request(app)
    .patch("/api/auth/password")
    .set("Authorization", `Bearer ${token}`)
    .send({ currentPassword: "wrong", newPassword: "newpassword99" });
  assert.equal(bad.status, 401);

  const ok = await request(app)
    .patch("/api/auth/password")
    .set("Authorization", `Bearer ${token}`)
    .send({ currentPassword: "password123", newPassword: "newpassword99" });
  assert.equal(ok.status, 200);

  const loginOld = await request(app)
    .post("/api/auth/login")
    .send({ login: "pwd@test.local", password: "password123" });
  assert.equal(loginOld.status, 401);

  const loginNew = await request(app)
    .post("/api/auth/login")
    .send({ login: "pwd@test.local", password: "newpassword99" });
  assert.equal(loginNew.status, 200);
});

test("PATCH /api/auth/email updates email with current password", async () => {
  const token = await registerAndLogin("oldmail@test.local", "mailuser", "password123");
  const bad = await request(app)
    .patch("/api/auth/email")
    .set("Authorization", `Bearer ${token}`)
    .send({ email: "newmail@test.local", currentPassword: "wrong" });
  assert.equal(bad.status, 401);

  const ok = await request(app)
    .patch("/api/auth/email")
    .set("Authorization", `Bearer ${token}`)
    .send({ email: "newmail@test.local", currentPassword: "password123" });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.email, "newmail@test.local");
});

test("GET /api/auth/me returns current user", async () => {
  const { token } = await createUserAndToken();
  const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.email, "http@test.local");
});

test("GET /api/portfolio/positions lists open holdings across accounts", async () => {
  const { token } = await createUserAndToken();
  const accountRes = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountType: "BROKERAGE",
      name: "Portfolio Broker",
      currency: "USD",
      openingBalance: 0,
    });
  const accountId = accountRes.body.id;

  const instrument = await prisma.instrument.create({
    data: { instrumentType: "STOCK", symbol: "PORT1", exchange: "TEST", currency: "USD" },
  });

  const holdingRes = await request(app)
    .post(`/api/accounts/${accountId}/holdings`)
    .set("Authorization", `Bearer ${token}`)
    .send({ instrumentId: instrument.id });
  assert.equal(holdingRes.status, 201);

  await request(app)
    .post(`/api/holdings/${holdingRes.body.id}/lots`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      side: "BUY",
      quantity: 2,
      pricePerUnit: 10,
      currency: "USD",
      tradeDate: "2025-01-10T12:00:00.000Z",
    });

  const res = await request(app)
    .get("/api/portfolio/positions")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.positions.length, 1);
  assert.equal(res.body.positions[0].accountName, "Portfolio Broker");
  assert.equal(res.body.positions[0].quantity, 2);
  assert.equal(res.body.positions[0].assetBucket, "stock_market");
});

test("GET /api/portfolio/positions filters by accountId", async () => {
  const { token } = await createUserAndToken();
  const a1 = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ accountType: "BROKERAGE", name: "A1", currency: "PLN", openingBalance: 0 });
  const a2 = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ accountType: "BROKERAGE", name: "A2", currency: "PLN", openingBalance: 0 });

  const inst = await prisma.instrument.create({
    data: { instrumentType: "ETF", symbol: "PFETF", exchange: "TEST", currency: "PLN" },
  });

  const h1 = await request(app)
    .post(`/api/accounts/${a1.body.id}/holdings`)
    .set("Authorization", `Bearer ${token}`)
    .send({ instrumentId: inst.id });
  await request(app)
    .post(`/api/holdings/${h1.body.id}/lots`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      side: "BUY",
      quantity: 1,
      pricePerUnit: 100,
      currency: "PLN",
      tradeDate: "2025-02-01T12:00:00.000Z",
    });

  const h2 = await request(app)
    .post(`/api/accounts/${a2.body.id}/holdings`)
    .set("Authorization", `Bearer ${token}`)
    .send({ instrumentId: inst.id });
  await request(app)
    .post(`/api/holdings/${h2.body.id}/lots`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      side: "BUY",
      quantity: 3,
      pricePerUnit: 100,
      currency: "PLN",
      tradeDate: "2025-02-01T12:00:00.000Z",
    });

  const filtered = await request(app)
    .get(`/api/portfolio/positions?accountId=${a1.body.id}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(filtered.status, 200);
  assert.equal(filtered.body.positions.length, 1);
  assert.equal(filtered.body.positions[0].quantity, 1);
});

test("GET /api/portfolio/positions rejects invalid assetBucket", async () => {
  const { token } = await createUserAndToken();
  const res = await request(app)
    .get("/api/portfolio/positions?assetBucket=invalid")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 400);
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

test("GET /api/instruments/:id returns instrument metadata", async () => {
  const { token } = await createUserAndToken();
  const instrument = await prisma.instrument.create({
    data: { instrumentType: "ETF", symbol: "METAHTTP", exchange: "TEST", currency: "USD" },
  });

  const res = await request(app)
    .get(`/api/instruments/${instrument.id}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.symbol, "METAHTTP");
  assert.equal(res.body.instrumentType, "ETF");
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

  const holdingDetail = await request(app)
    .get(`/api/holdings/${holdingId}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(holdingDetail.status, 200);
  assert.equal(holdingDetail.body.costBasis, 1000);
  assert.equal(holdingDetail.body.quantity, 10);

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

test("POST /api/transactions rejects currency mismatch with 400", async () => {
  const { token } = await createUserAndToken();
  const accountRes = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountType: "BANK",
      name: "PLN Bank",
      currency: "PLN",
      openingBalance: 100,
    });
  const accountId = accountRes.body.id;

  const res = await request(app)
    .post("/api/transactions")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountId,
      transactionType: "INCOME",
      amount: 50,
      currency: "USD",
      category: "SALARY",
      date: "2025-01-10T12:00:00.000Z",
    });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /currency must match account/i);
});

test("GET /api/transactions rejects invalid accountId query with 400", async () => {
  const { token } = await createUserAndToken();
  const res = await request(app)
    .get("/api/transactions?accountId=not-a-number")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 400);
});

test("manual instrument valuation recompute is scoped to caller accounts", async () => {
  const { token: tokenA } = await createUserAndToken();
  const { token: tokenB } = await createSecondUser();

  const instrument = await prisma.instrument.create({
    data: { instrumentType: "STOCK", symbol: "SCOPE", exchange: "TEST", currency: "USD" },
  });

  const accountRes = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${tokenA}`)
    .send({
      accountType: "BROKERAGE",
      name: "User A Scope Broker",
      currency: "USD",
      openingBalance: 0,
    });
  const accountIdA = accountRes.body.id;

  await request(app)
    .post("/api/transactions")
    .set("Authorization", `Bearer ${tokenA}`)
    .send({
      accountId: accountIdA,
      transactionType: "TRANSFER_IN",
      amount: 5000,
      currency: "USD",
      category: "FUNDING",
      date: "2025-01-01T12:00:00.000Z",
    });

  const holdingRes = await request(app)
    .post(`/api/accounts/${accountIdA}/holdings`)
    .set("Authorization", `Bearer ${tokenA}`)
    .send({ instrumentId: instrument.id });
  const holdingId = holdingRes.body.id;

  await request(app)
    .post(`/api/holdings/${holdingId}/lots`)
    .set("Authorization", `Bearer ${tokenA}`)
    .send({
      side: "BUY",
      quantity: 10,
      pricePerUnit: 100,
      currency: "USD",
      tradeDate: "2025-01-05T12:00:00.000Z",
    });

  await request(app)
    .post(`/api/instruments/${instrument.id}/valuations`)
    .set("Authorization", `Bearer ${tokenA}`)
    .send({
      valuationDate: "2025-01-10T12:00:00.000Z",
      price: 100,
      currency: "USD",
    });

  const beforeB = await request(app)
    .get(`/api/accounts/${accountIdA}/valuations?from=2025-01-01&to=2025-01-31`)
    .set("Authorization", `Bearer ${tokenA}`);
  assert.equal(beforeB.status, 200);

  await request(app)
    .post(`/api/instruments/${instrument.id}/valuations`)
    .set("Authorization", `Bearer ${tokenB}`)
    .send({
      valuationDate: "2025-01-15T12:00:00.000Z",
      price: 200,
      currency: "USD",
    });

  const afterB = await request(app)
    .get(`/api/accounts/${accountIdA}/valuations?from=2025-01-01&to=2025-01-31`)
    .set("Authorization", `Bearer ${tokenA}`);
  assert.equal(afterB.status, 200);
  assert.deepEqual(afterB.body, beforeB.body);
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
  assert.ok(Array.isArray(res.body.byBucket));
  assert.equal(res.body.byBucket.length, 5);
  assert.ok(res.body.byBucket.some((row: { bucket: string }) => row.bucket === 'cash'));
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

test("GET /api/stats/cashflow excludes internal transfers", async () => {
  const { token } = await createUserAndToken();
  const accountRes = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountType: "BANK",
      name: "Transfer CF Bank",
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
      amount: 200,
      currency: "PLN",
      category: "SALARY",
      date: "2025-03-01T12:00:00.000Z",
    });
  await request(app)
    .post("/api/transactions")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountId,
      transactionType: "TRANSFER_IN",
      amount: 500,
      currency: "PLN",
      category: "FUNDING",
      date: "2025-03-02T12:00:00.000Z",
    });
  await request(app)
    .post("/api/transactions")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountId,
      transactionType: "TRANSFER_OUT",
      amount: 50,
      currency: "PLN",
      category: "MOVE",
      date: "2025-03-03T12:00:00.000Z",
    });

  const res = await request(app)
    .get("/api/stats/cashflow?from=2025-03-01&to=2025-03-31&currency=PLN")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.income, 200);
  assert.equal(res.body.expense, 0);
  assert.equal(res.body.net, 200);
});

test("GET /api/stats/cashflow-history returns monthly buckets", async () => {
  const { token } = await createUserAndToken();
  const accountRes = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountType: "BANK",
      name: "History Bank",
      currency: "PLN",
      openingBalance: 0,
    });
  const accountId = accountRes.body.id;

  await request(app)
    .post("/api/transactions")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountId,
      transactionType: "INCOME",
      amount: 1000,
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
      amount: 200,
      currency: "PLN",
      category: "FOOD",
      date: "2025-01-20T12:00:00.000Z",
    });
  await request(app)
    .post("/api/transactions")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountId,
      transactionType: "EXPENSE",
      amount: 50,
      currency: "PLN",
      category: "TRAVEL",
      date: "2025-02-10T12:00:00.000Z",
    });

  const res = await request(app)
    .get("/api/stats/cashflow-history?from=2025-01-01&to=2025-02-28&currency=PLN")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.currency, "PLN");
  assert.equal(res.body.points.length, 2);
  assert.equal(res.body.points[0].month, "2025-01");
  assert.equal(res.body.points[0].income, 1000);
  assert.equal(res.body.points[0].expense, 200);
  assert.equal(res.body.points[0].net, 800);
  assert.equal(res.body.points[1].month, "2025-02");
  assert.equal(res.body.points[1].expense, 50);
});

test("GET /api/stats/cashflow-rolling-12m returns monthly averages", async () => {
  const { token } = await createUserAndToken();
  const accountRes = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountType: "BANK",
      name: "Rolling Bank",
      currency: "PLN",
      openingBalance: 0,
    });
  const accountId = accountRes.body.id;

  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const tradeDate = new Date(prevYear, prevMonth, 15, 12, 0, 0).toISOString();

  await request(app)
    .post("/api/transactions")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountId,
      transactionType: "INCOME",
      amount: 1200,
      currency: "PLN",
      category: "SALARY",
      date: tradeDate,
    });
  await request(app)
    .post("/api/transactions")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountId,
      transactionType: "EXPENSE",
      amount: 300,
      currency: "PLN",
      category: "FOOD",
      date: tradeDate,
    });

  const res = await request(app)
    .get("/api/stats/cashflow-rolling-12m?currency=PLN")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.currency, "PLN");
  assert.equal(res.body.months, 12);
  assert.ok(res.body.avgIncome > 0);
  assert.ok(res.body.avgExpense > 0);
  assert.ok(res.body.avgNet > 0);
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

test("GET /api/stats/portfolio-summary returns brokerage summary", async () => {
  const { token } = await createUserAndToken();
  const accountRes = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountType: "BROKERAGE",
      name: "Portfolio Broker",
      currency: "PLN",
      openingBalance: 10000,
    });
  const accountId = accountRes.body.id;

  await request(app)
    .post("/api/transactions")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountId,
      transactionType: "TRANSFER_IN",
      amount: 5000,
      currency: "PLN",
      category: "DEPOSIT",
      date: "2025-01-05T12:00:00.000Z",
    });

  const res = await request(app)
    .get("/api/stats/portfolio-summary?from=2025-01-01&to=2025-01-31&currency=PLN")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(typeof res.body.totalValue, "number");
  assert.equal(res.body.displayCurrency, "PLN");
  assert.ok(Array.isArray(res.body.allocation));
});

test("GET /api/stats/average-holding-return returns value-weighted average", async () => {
  const { token } = await createUserAndToken();
  const accountRes = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountType: "BROKERAGE",
      name: "Return Broker",
      currency: "PLN",
      openingBalance: 0,
    });
  const accountId = accountRes.body.id;

  const instrument = await prisma.instrument.create({
    data: { instrumentType: "STOCK", symbol: "AVG1", exchange: "TEST", currency: "PLN" },
  });
  await prisma.instrumentValuation.create({
    data: {
      instrumentId: instrument.id,
      valuationDate: new Date("2025-01-10T12:00:00.000Z"),
      price: 110,
      currency: "PLN",
      source: "manual",
    },
  });

  const holdingRes = await request(app)
    .post(`/api/accounts/${accountId}/holdings`)
    .set("Authorization", `Bearer ${token}`)
    .send({ instrumentId: instrument.id });
  await request(app)
    .post(`/api/holdings/${holdingRes.body.id}/lots`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      side: "BUY",
      quantity: 10,
      pricePerUnit: 100,
      currency: "PLN",
      tradeDate: "2025-01-05T12:00:00.000Z",
    });

  const res = await request(app)
    .get("/api/stats/average-holding-return?currency=PLN")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.displayCurrency, "PLN");
  assert.ok(res.body.averageReturnPct != null);
  assert.ok(Math.abs(res.body.averageReturnPct - 10) < 0.01);
});

test("GET /api/asset-trades lists buy and sell lots", async () => {
  const { token } = await createUserAndToken();
  const accountRes = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountType: "BROKERAGE",
      name: "Trade Broker",
      currency: "PLN",
      openingBalance: 10000,
    });
  const accountId = accountRes.body.id;

  const instrument = await prisma.instrument.create({
    data: { instrumentType: "STOCK", symbol: "TRD1", exchange: "TEST", currency: "PLN" },
  });

  const createRes = await request(app)
    .post("/api/asset-trades")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountId,
      instrumentId: instrument.id,
      side: "BUY",
      quantity: 5,
      pricePerUnit: 20,
      currency: "PLN",
      tradeDate: "2025-03-01T12:00:00.000Z",
    });
  assert.equal(createRes.status, 201);
  assert.equal(createRes.body.side, "BUY");
  assert.equal(createRes.body.instrument.symbol, "TRD1");

  const listRes = await request(app)
    .get(`/api/asset-trades?accountId=${accountId}&from=2025-03-01&to=2025-03-31`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(listRes.status, 200);
  assert.equal(listRes.body.length, 1);
  assert.equal(listRes.body[0].quantity, 5);
});

test("GET /api/accounts/:accountId/assets/:instrumentId returns holding summary (FR-014)", async () => {
  const { token } = await createUserAndToken();
  const accountRes = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountType: "BROKERAGE",
      name: "Asset Route Broker",
      currency: "PLN",
      openingBalance: 5000,
    });
  const accountId = accountRes.body.id;
  const instrument = await prisma.instrument.create({
    data: { instrumentType: "STOCK", symbol: "RTE1", exchange: "TEST", currency: "PLN" },
  });
  await request(app)
    .post("/api/asset-trades")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountId,
      instrumentId: instrument.id,
      side: "BUY",
      quantity: 2,
      pricePerUnit: 50,
      currency: "PLN",
      tradeDate: "2025-04-01T12:00:00.000Z",
    });

  const res = await request(app)
    .get(`/api/accounts/${accountId}/assets/${instrument.id}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.instrumentId, instrument.id);
  assert.equal(res.body.quantity, 2);
});

test("POST /api/asset-trades stores commission and debits cash (FR-007)", async () => {
  const { token } = await createUserAndToken();
  const accountRes = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountType: "BROKERAGE",
      name: "Commission Broker",
      currency: "PLN",
      openingBalance: 1000,
    });
  const accountId = accountRes.body.id;
  const instrument = await prisma.instrument.create({
    data: { instrumentType: "STOCK", symbol: "COM1", exchange: "TEST", currency: "PLN" },
  });

  const createRes = await request(app)
    .post("/api/asset-trades")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountId,
      instrumentId: instrument.id,
      side: "BUY",
      quantity: 10,
      pricePerUnit: 10,
      commission: 5,
      currency: "PLN",
      tradeDate: "2025-05-01T12:00:00.000Z",
    });
  assert.equal(createRes.status, 201);
  assert.equal(createRes.body.commission, 5);

  const account = await request(app)
    .get(`/api/accounts/${accountId}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(account.body.cashBalance, 895);
});

test("POST /api/accounts stores openingCashAsOf (DATA-002)", async () => {
  const { token } = await createUserAndToken();
  const res = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountType: "BANK",
      name: "Opening As Of",
      currency: "PLN",
      openingBalance: 500,
      openingCashAsOf: "2024-06-15T00:00:00.000Z",
    });
  assert.equal(res.status, 201);
  assert.ok(res.body.openingCashAsOf);
  assert.equal(res.body.openingCashAsOf.slice(0, 10), "2024-06-15");
});

test("GET /api/asset-trades filters by instrumentId", async () => {
  const { token } = await createUserAndToken();
  const accountRes = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ accountType: "BROKERAGE", name: "Filter Broker", currency: "PLN", openingBalance: 5000 });
  const accountId = accountRes.body.id;

  const inst1 = await prisma.instrument.create({
    data: { instrumentType: "STOCK", symbol: "F1", exchange: "TEST", currency: "PLN" },
  });
  const inst2 = await prisma.instrument.create({
    data: { instrumentType: "ETF", symbol: "F2", exchange: "TEST", currency: "PLN" },
  });

  for (const instrumentId of [inst1.id, inst2.id]) {
    await request(app)
      .post("/api/asset-trades")
      .set("Authorization", `Bearer ${token}`)
      .send({
        accountId,
        instrumentId,
        side: "BUY",
        quantity: 1,
        pricePerUnit: 10,
        currency: "PLN",
        tradeDate: "2025-04-10T12:00:00.000Z",
      });
  }

  const res = await request(app)
    .get(`/api/asset-trades?instrumentId=${inst2.id}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 1);
  assert.equal(res.body[0].instrumentId, inst2.id);
});

test("POST /api/asset-trades rejects non-brokerage account", async () => {
  const { token } = await createUserAndToken();
  const accountRes = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountType: "BANK",
      name: "Bank",
      currency: "PLN",
      openingBalance: 1000,
    });
  const instrument = await prisma.instrument.create({
    data: { instrumentType: "STOCK", symbol: "BANKX", exchange: "TEST", currency: "PLN" },
  });

  const res = await request(app)
    .post("/api/asset-trades")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountId: accountRes.body.id,
      instrumentId: instrument.id,
      side: "BUY",
      quantity: 1,
      pricePerUnit: 10,
      currency: "PLN",
      tradeDate: "2025-03-01T12:00:00.000Z",
    });
  assert.equal(res.status, 400);
});

test("POST /api/asset-trades rejects invalid side", async () => {
  const { token } = await createUserAndToken();
  const accountRes = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ accountType: "BROKERAGE", name: "Side Broker", currency: "PLN", openingBalance: 0 });
  const instrument = await prisma.instrument.create({
    data: { instrumentType: "STOCK", symbol: "SIDE1", exchange: "TEST", currency: "PLN" },
  });

  const res = await request(app)
    .post("/api/asset-trades")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountId: accountRes.body.id,
      instrumentId: instrument.id,
      side: "HOLD",
      quantity: 1,
      pricePerUnit: 10,
      currency: "PLN",
      tradeDate: "2025-03-01T12:00:00.000Z",
    });
  assert.equal(res.status, 400);
});

test("POST /api/asset-trades rejects unknown instrument", async () => {
  const { token } = await createUserAndToken();
  const accountRes = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ accountType: "BROKERAGE", name: "Inst Broker", currency: "PLN", openingBalance: 0 });

  const res = await request(app)
    .post("/api/asset-trades")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountId: accountRes.body.id,
      instrumentId: 999999,
      side: "BUY",
      quantity: 1,
      pricePerUnit: 10,
      currency: "PLN",
      tradeDate: "2025-03-01T12:00:00.000Z",
    });
  assert.equal(res.status, 404);
});

test("POST /api/internal-transfers creates paired same-currency transfer", async () => {
  const { token } = await createUserAndToken();
  const from = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ accountType: "BANK", name: "From Bank", currency: "PLN", openingBalance: 1000 });
  const to = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ accountType: "BANK", name: "To Bank", currency: "PLN", openingBalance: 0 });

  const nwBefore = await request(app)
    .get("/api/stats/net-worth?currency=PLN")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(nwBefore.status, 200);

  const createRes = await request(app)
    .post("/api/internal-transfers")
    .set("Authorization", `Bearer ${token}`)
    .send({
      fromAccountId: from.body.id,
      toAccountId: to.body.id,
      fromAmount: 250,
      toAmount: 250,
      date: "2025-04-01T12:00:00.000Z",
      note: "Savings move",
    });
  assert.equal(createRes.status, 201);
  assert.equal(createRes.body.fromAmount, 250);
  assert.equal(createRes.body.toAmount, 250);

  const listRes = await request(app)
    .get("/api/internal-transfers?from=2025-04-01&to=2025-04-30")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(listRes.status, 200);
  assert.equal(listRes.body.transfers.length, 1);

  const accountFilterRes = await request(app)
    .get(`/api/internal-transfers?accountId=${from.body.id}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(accountFilterRes.status, 200);
  assert.equal(accountFilterRes.body.transfers.length, 1);

  const fromAccount = await request(app)
    .get(`/api/accounts/${from.body.id}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(fromAccount.body.cashBalance, 750);

  const cashflowRes = await request(app)
    .get("/api/stats/cashflow?from=2025-04-01&to=2025-04-30&currency=PLN")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(cashflowRes.body.income, 0);
  assert.equal(cashflowRes.body.expense, 0);

  const nwAfter = await request(app)
    .get("/api/stats/net-worth?currency=PLN")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(nwAfter.status, 200);
  assert.equal(nwAfter.body.total, nwBefore.body.total);
});

test("PUT/DELETE /api/transactions reject internal transfer legs", async () => {
  const { token } = await createUserAndToken();
  const from = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ accountType: "BANK", name: "Leg From", currency: "PLN", openingBalance: 1000 });
  const to = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ accountType: "BANK", name: "Leg To", currency: "PLN", openingBalance: 0 });

  const createRes = await request(app)
    .post("/api/internal-transfers")
    .set("Authorization", `Bearer ${token}`)
    .send({
      fromAccountId: from.body.id,
      toAccountId: to.body.id,
      fromAmount: 100,
      toAmount: 100,
      date: "2025-05-01T12:00:00.000Z",
    });
  assert.equal(createRes.status, 201);

  const listRes = await request(app)
    .get("/api/internal-transfers")
    .set("Authorization", `Bearer ${token}`);
  const legId = listRes.body.transfers[0].outTransactionId as number;

  const putRes = await request(app)
    .put(`/api/transactions/${legId}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ amount: 1 });
  assert.equal(putRes.status, 400);
  assert.match(putRes.body.error, /cannot be edited/i);

  const delRes = await request(app)
    .delete(`/api/transactions/${legId}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(delRes.status, 400);
  assert.match(delRes.body.error, /cannot be deleted/i);
});

test("POST /api/internal-transfers supports cross-currency with commission", async () => {
  const { token } = await createUserAndToken();
  const from = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ accountType: "BANK", name: "USD Bank", currency: "USD", openingBalance: 1000 });
  const to = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ accountType: "BANK", name: "PLN Bank", currency: "PLN", openingBalance: 0 });

  const createRes = await request(app)
    .post("/api/internal-transfers")
    .set("Authorization", `Bearer ${token}`)
    .send({
      fromAccountId: from.body.id,
      toAccountId: to.body.id,
      fromAmount: 100,
      toAmount: 400,
      exchangeRate: 4,
      commission: 5,
      date: "2025-04-20T12:00:00.000Z",
    });
  assert.equal(createRes.status, 201);
  assert.equal(createRes.body.commission, 5);
  assert.equal(createRes.body.exchangeRate, 4);

  const fromAccount = await request(app)
    .get(`/api/accounts/${from.body.id}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(fromAccount.body.cashBalance, 895);
});

test("POST /api/internal-transfers rejects same account", async () => {
  const { token } = await createUserAndToken();
  const account = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ accountType: "BANK", name: "Solo", currency: "PLN", openingBalance: 1000 });

  const res = await request(app)
    .post("/api/internal-transfers")
    .set("Authorization", `Bearer ${token}`)
    .send({
      fromAccountId: account.body.id,
      toAccountId: account.body.id,
      fromAmount: 100,
      toAmount: 100,
      date: "2025-04-01T12:00:00.000Z",
    });
  assert.equal(res.status, 400);
});

test("GET /api/internal-transfers/fx-suggestion returns cross rate", async () => {
  const { token } = await createUserAndToken();
  const res = await request(app)
    .get("/api/internal-transfers/fx-suggestion?fromCurrency=USD&toCurrency=PLN&fromAmount=100")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.exchangeRate > 0);
  assert.ok(res.body.suggestedToAmount > 0);
});

test("DELETE /api/internal-transfers/:groupId removes transfer pair", async () => {
  const { token } = await createUserAndToken();
  const from = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ accountType: "BANK", name: "Del From", currency: "PLN", openingBalance: 500 });
  const to = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ accountType: "BANK", name: "Del To", currency: "PLN", openingBalance: 0 });

  const created = await request(app)
    .post("/api/internal-transfers")
    .set("Authorization", `Bearer ${token}`)
    .send({
      fromAccountId: from.body.id,
      toAccountId: to.body.id,
      fromAmount: 50,
      toAmount: 50,
      date: "2025-04-15T12:00:00.000Z",
    });
  assert.equal(created.status, 201);

  const delRes = await request(app)
    .delete(`/api/internal-transfers/${created.body.groupId}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(delRes.status, 204);

  const listRes = await request(app)
    .get("/api/internal-transfers")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(listRes.body.transfers.length, 0);
});

test("GET /api/stats/benchmark-comparison requires benchmark", async () => {
  const { token } = await createUserAndToken();
  const res = await request(app)
    .get("/api/stats/benchmark-comparison?from=2025-01-01&to=2025-01-31&benchmark=INVALID")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 400);
});

test("GET /api/accounts/:id/stats returns YTD cashflow and YoY fields", async () => {
  const { token } = await createUserAndToken();
  const accountRes = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountType: "BANK",
      name: "Stats Bank",
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
      amount: 200,
      currency: "PLN",
      category: "SALARY",
      date: "2026-01-15T12:00:00.000Z",
    });

  const res = await request(app)
    .get(`/api/accounts/${accountId}/stats`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.currency, "PLN");
  assert.equal(res.body.ytdIncome, 200);
  assert.equal(res.body.ytdExpense, 0);
  assert.equal(res.body.ytdNet, 200);
  assert.ok(typeof res.body.currentTotal === "number");
});

test("POST /api/accounts/:id/revalue updates MANUAL account", async () => {
  const { token } = await createUserAndToken();
  const accountRes = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountType: "MANUAL",
      name: "Flat",
      currency: "PLN",
      openingBalance: 400000,
    });
  const accountId = accountRes.body.id;

  const res = await request(app)
    .post(`/api/accounts/${accountId}/revalue`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      value: 420000,
      valuationDate: "2025-06-01T12:00:00.000Z",
    });
  assert.equal(res.status, 200);
  assert.equal(res.body.cashBalance, 420000);
});

test("POST /api/accounts/:id/revalue rejects bank accounts", async () => {
  const { token } = await createUserAndToken();
  const bankRes = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountType: "BANK",
      name: "Bank",
      currency: "PLN",
      openingBalance: 1000,
    });
  const res = await request(app)
    .post(`/api/accounts/${bankRes.body.id}/revalue`)
    .set("Authorization", `Bearer ${token}`)
    .send({ value: 2000 });
  assert.equal(res.status, 400);
});

test("GET /api/categories seeds defaults and supports CRUD (FR-015)", async () => {
  const { token } = await createUserAndToken();
  const listRes = await request(app)
    .get("/api/categories")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(listRes.status, 200);
  assert.ok(listRes.body.flat.length >= 8);

  const createRes = await request(app)
    .post("/api/categories")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Custom Cat" });
  assert.equal(createRes.status, 201);
  assert.equal(createRes.body.name, "Custom Cat");

  const updateRes = await request(app)
    .put(`/api/categories/${createRes.body.id}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Renamed Cat" });
  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body.name, "Renamed Cat");

  const delRes = await request(app)
    .delete(`/api/categories/${createRes.body.id}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(delRes.status, 204);
});

test("PUT /api/budgets tracks monthly limit (FR-017)", async () => {
  const { token } = await createUserAndToken();
  const cats = await request(app).get("/api/categories").set("Authorization", `Bearer ${token}`);
  const food = cats.body.flat.find((c: { name: string }) => c.name === "Food");
  assert.ok(food);

  const saveRes = await request(app)
    .put("/api/budgets")
    .set("Authorization", `Bearer ${token}`)
    .send({
      categoryId: food.id,
      budgetMonth: "2026-06-01",
      amount: 500,
      currency: "PLN",
    });
  assert.equal(saveRes.status, 200);
  assert.equal(saveRes.body.amount, 500);

  const listRes = await request(app)
    .get("/api/budgets?month=2026-06&currency=PLN")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(listRes.status, 200);
  assert.equal(listRes.body.length, 1);

  const delRes = await request(app)
    .delete(`/api/budgets/${saveRes.body.id}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(delRes.status, 204);
});

test("POST /api/transactions supports categoryId and splits (FR-018)", async () => {
  const { token } = await createUserAndToken();
  const accountRes = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountType: "BANK",
      name: "Split Bank",
      currency: "PLN",
      openingBalance: 1000,
    });
  const cats = await request(app).get("/api/categories").set("Authorization", `Bearer ${token}`);
  const food = cats.body.flat.find((c: { name: string }) => c.name === "Food");
  const transport = cats.body.flat.find((c: { name: string }) => c.name === "Transport");
  assert.ok(food && transport);

  const splitRes = await request(app)
    .post("/api/transactions")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountId: accountRes.body.id,
      transactionType: "EXPENSE",
      amount: 100,
      currency: "PLN",
      date: "2026-06-10T12:00:00.000Z",
      splits: [
        { categoryId: food.id, amount: 60 },
        { categoryId: transport.id, amount: 40 },
      ],
    });
  assert.equal(splitRes.status, 201);
  assert.equal(splitRes.body.category, "SPLIT");
  assert.equal(splitRes.body.splits.length, 2);
});

test("GET/POST /api/income-events supports CRUD (FR-024)", async () => {
  const { token } = await createUserAndToken();
  const accountRes = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountType: "BANK",
      name: "Income Bank",
      currency: "PLN",
      openingBalance: 0,
    });

  const createRes = await request(app)
    .post("/api/income-events")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountId: accountRes.body.id,
      eventType: "interest",
      amount: 120,
      currency: "PLN",
      date: "2026-04-01T12:00:00.000Z",
      withheldTax: 19,
    });
  assert.equal(createRes.status, 201);
  assert.equal(createRes.body.taxType, "belka");

  const listRes = await request(app)
    .get("/api/income-events")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(listRes.status, 200);
  assert.equal(listRes.body.length, 1);

  const taxRes = await request(app)
    .get("/api/stats/tax-report?year=2026&currency=PLN")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(taxRes.status, 200);
  assert.ok(taxRes.body.belka.interestGross >= 120);

  const updateRes = await request(app)
    .put(`/api/income-events/${createRes.body.id}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ amount: 150 });
  assert.equal(updateRes.status, 200);

  const delRes = await request(app)
    .delete(`/api/income-events/${createRes.body.id}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(delRes.status, 204);
});

test("GET/POST /api/liabilities and net worth subtracts balance (FR-029)", async () => {
  const { token } = await createUserAndToken();
  const createRes = await request(app)
    .post("/api/liabilities")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "Mortgage",
      liabilityType: "mortgage",
      balance: 200000,
      currency: "PLN",
    });
  assert.equal(createRes.status, 201);

  const nwBefore = await request(app)
    .get("/api/stats/net-worth?currency=PLN")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(nwBefore.status, 200);
  assert.equal(nwBefore.body.totalLiabilities, 200000);

  const delRes = await request(app)
    .delete(`/api/liabilities/${createRes.body.id}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(delRes.status, 204);
});

test("POST /api/property-cash-flows on REAL_ESTATE account (FR-030)", async () => {
  const { token } = await createUserAndToken();
  const accountRes = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountType: "REAL_ESTATE",
      name: "Rental flat",
      currency: "PLN",
      openingBalance: 400000,
    });

  const flowRes = await request(app)
    .post("/api/property-cash-flows")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountId: accountRes.body.id,
      flowType: "rent",
      amount: 3000,
      currency: "PLN",
      date: "2026-05-01T12:00:00.000Z",
    });
  assert.equal(flowRes.status, 201);

  const taxRes = await request(app)
    .get("/api/stats/tax-report?year=2026&currency=PLN")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(taxRes.status, 200);
  assert.equal(taxRes.body.rental.available, true);
  assert.equal(taxRes.body.rental.rentalIncome, 3000);
});

test("POST /api/asset-valuations on REAL_ESTATE account (DATA-024)", async () => {
  const { token } = await createUserAndToken();
  const accountRes = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountType: "REAL_ESTATE",
      name: "House",
      currency: "PLN",
      openingBalance: 800000,
    });
  assert.equal(accountRes.status, 201);

  const valRes = await request(app)
    .post("/api/asset-valuations")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountId: accountRes.body.id,
      value: 850000,
      currency: "PLN",
      date: "2026-01-15T12:00:00.000Z",
      description: "Market estimate",
    });
  assert.equal(valRes.status, 201);
  assert.equal(valRes.body.value, 850000);

  const listRes = await request(app)
    .get(`/api/asset-valuations?accountId=${accountRes.body.id}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(listRes.status, 200);
  assert.equal(listRes.body.length, 1);

  const accountGet = await request(app)
    .get(`/api/accounts/${accountRes.body.id}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(accountGet.body.cashBalance, 850000);
});

test("coupon schedule and record income (FR-033)", async () => {
  const { token } = await createUserAndToken();
  const accountRes = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ accountType: "BROKERAGE", name: "Bond broker", currency: "PLN", openingBalance: 5000 });
  const instrumentRes = await request(app)
    .post("/api/instruments")
    .set("Authorization", `Bearer ${token}`)
    .send({ instrumentType: "ETF", symbol: "AGBD", currency: "PLN" });
  const holdingRes = await request(app)
    .post(`/api/accounts/${accountRes.body.id}/holdings`)
    .set("Authorization", `Bearer ${token}`)
    .send({ instrumentId: instrumentRes.body.id });
  assert.equal(holdingRes.status, 201);

  await request(app)
    .post(`/api/holdings/${holdingRes.body.id}/lots`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      side: "BUY",
      quantity: 10,
      pricePerUnit: 100,
      currency: "PLN",
      tradeDate: "2025-01-10T12:00:00.000Z",
    });

  const schedRes = await request(app)
    .post("/api/coupon-schedules")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountId: accountRes.body.id,
      instrumentId: instrumentRes.body.id,
      scheduleType: "coupon",
      amount: 45,
      currency: "PLN",
      date: "2026-04-01T12:00:00.000Z",
    });
  assert.equal(schedRes.status, 201);
  assert.equal(schedRes.body.recorded, false);

  const recordRes = await request(app)
    .post(`/api/coupon-schedules/${schedRes.body.id}/record-income`)
    .set("Authorization", `Bearer ${token}`)
    .send({});
  assert.equal(recordRes.status, 200);
  assert.equal(recordRes.body.recorded, true);

  const incomeRes = await request(app)
    .get("/api/income-events")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(incomeRes.status, 200);
  assert.ok(incomeRes.body.some((e: { eventType: string }) => e.eventType === "coupon"));
});

test("Phase D automation: rules, alerts, export, audit (FR-034–038, NFR-002–003)", async () => {
  const { token } = await createUserAndToken();
  const catRes = await request(app)
    .post("/api/categories")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Groceries PhaseD" });
  assert.equal(catRes.status, 201);

  const ruleRes = await request(app)
    .post("/api/categorization-rules")
    .set("Authorization", `Bearer ${token}`)
    .send({ categoryId: catRes.body.id, pattern: "SHOP", matchType: "contains", priority: 1 });
  assert.equal(ruleRes.status, 201);

  const bankRes = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ accountType: "BANK", name: "Main bank", currency: "PLN", openingBalance: 1000 });
  assert.equal(bankRes.status, 201);

  await request(app)
    .put("/api/budgets")
    .set("Authorization", `Bearer ${token}`)
    .send({
      categoryId: catRes.body.id,
      budgetMonth: "2026-06-01",
      amount: 100,
      currency: "PLN",
    });

  const nwRes = await request(app)
    .get("/api/stats/net-worth?currency=PLN")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(nwRes.status, 200);
  assert.equal(nwRes.body.consolidatedCurrency, "PLN");
  assert.ok(nwRes.body.fxRatesAsOf);

  const alertsRes = await request(app)
    .get("/api/budgets/alerts?month=2026-06&currency=PLN")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(alertsRes.status, 200);
  assert.ok(Array.isArray(alertsRes.body));

  const exportRes = await request(app)
    .get("/api/export/full?format=json")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(exportRes.status, 200);
  assert.ok(exportRes.body.user);
  assert.equal(exportRes.body.formatVersion, 2);
  assert.ok(Array.isArray(exportRes.body.accounts));

  const txRes = await request(app)
    .post("/api/transactions")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountId: bankRes.body.id,
      transactionType: "EXPENSE",
      amount: 50,
      currency: "PLN",
      category: "Groceries PhaseD",
      categoryId: catRes.body.id,
      date: "2026-06-10T12:00:00.000Z",
      description: "Test",
    });
  assert.equal(txRes.status, 201);

  const auditRes = await request(app)
    .get("/api/audit-logs?entityType=transaction")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(auditRes.status, 200);
  assert.ok(auditRes.body.some((row: { action: string }) => row.action === "create"));

  const connRes = await request(app)
    .post("/api/bank-connections")
    .set("Authorization", `Bearer ${token}`)
    .send({ accountId: bankRes.body.id, bankCode: "MBANK" });
  assert.equal(connRes.status, 201);
  assert.equal(connRes.body.status, "pending");

  const authRes = await request(app)
    .post(`/api/bank-connections/${connRes.body.id}/authorize`)
    .set("Authorization", `Bearer ${token}`)
    .send({});
  assert.equal(authRes.status, 200);
  assert.equal(authRes.body.status, "connected");
});

test("tax wrappers, position transfers, corporate actions (FR-039–041)", async () => {
  const { token } = await createUserAndToken();
  const brokerA = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ accountType: "BROKERAGE", name: "Broker A", currency: "PLN", openingBalance: 10000 });
  const brokerB = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ accountType: "BROKERAGE", name: "Broker B", currency: "PLN", openingBalance: 0 });
  assert.equal(brokerA.status, 201);
  assert.equal(brokerB.status, 201);

  const ikeUpdate = await request(app)
    .put(`/api/accounts/${brokerA.body.id}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ taxWrapperType: "ike" });
  assert.equal(ikeUpdate.status, 200);
  assert.equal(ikeUpdate.body.taxWrapperType, "ike");

  const withdrawalRes = await request(app)
    .post("/api/tax-wrapper-withdrawals")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountId: brokerA.body.id,
      amount: 500,
      currency: "PLN",
      withdrawnOn: "2026-03-01T12:00:00.000Z",
      withdrawalType: "partial",
      includeInPit38: true,
    });
  assert.equal(withdrawalRes.status, 201);

  const instrumentRes = await request(app)
    .post("/api/instruments")
    .set("Authorization", `Bearer ${token}`)
    .send({ instrumentType: "STOCK", symbol: "TST", currency: "PLN" });
  assert.equal(instrumentRes.status, 201);

  const holdingRes = await request(app)
    .post(`/api/accounts/${brokerA.body.id}/holdings`)
    .set("Authorization", `Bearer ${token}`)
    .send({ instrumentId: instrumentRes.body.id });
  assert.equal(holdingRes.status, 201);

  const lotRes = await request(app)
    .post(`/api/holdings/${holdingRes.body.id}/lots`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      side: "BUY",
      quantity: 10,
      pricePerUnit: 10,
      currency: "PLN",
      tradeDate: "2026-01-01T12:00:00.000Z",
      settlementDate: "2026-01-03T12:00:00.000Z",
    });
  assert.equal(lotRes.status, 201);
  assert.equal(lotRes.body.settlementDate?.slice(0, 10), "2026-01-03");

  const transferRes = await request(app)
    .post("/api/position-transfers")
    .set("Authorization", `Bearer ${token}`)
    .send({
      fromAccountId: brokerA.body.id,
      toAccountId: brokerB.body.id,
      instrumentId: instrumentRes.body.id,
      quantity: 4,
      transferDate: "2026-02-01T12:00:00.000Z",
    });
  assert.equal(transferRes.status, 201);
  assert.equal(transferRes.body.quantity, 4);

  const actionRes = await request(app)
    .post("/api/corporate-actions")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountId: brokerB.body.id,
      instrumentId: instrumentRes.body.id,
      actionType: "stock_split",
      actionDate: "2026-04-01T12:00:00.000Z",
      ratio: 2,
    });
  assert.equal(actionRes.status, 201);
  assert.equal(actionRes.body.ratio, 2);

  const listRes = await request(app)
    .get("/api/position-transfers")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(listRes.status, 200);
  assert.equal(listRes.body.length, 1);
});

test("POST /api/import/bank-transactions previews mBank CSV (FR-019)", async () => {
  const { token } = await createUserAndToken();
  const accountRes = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountType: "BANK",
      name: "Import Bank",
      currency: "PLN",
      openingBalance: 1000,
    });
  const csv = `#Data operacji;#Opis operacji;#Kwota;
15.01.2026;Sklep;-25,00
16.01.2026;Wypłata;100,00`;
  const previewRes = await request(app)
    .post(`/api/import/bank-transactions?accountId=${accountRes.body.id}&bank=mbank&dryRun=true`)
    .set("Authorization", `Bearer ${token}`)
    .send({ csv });
  assert.equal(previewRes.status, 200);
  assert.equal(previewRes.body.dryRun, true);
  assert.equal(previewRes.body.parsed, 2);

  const importRes = await request(app)
    .post(`/api/import/bank-transactions?accountId=${accountRes.body.id}&bank=mbank`)
    .set("Authorization", `Bearer ${token}`)
    .send({ csv });
  assert.equal(importRes.status, 200);
  assert.equal(importRes.body.imported, 2);
  assert.ok(importRes.body.batchId);

  const auditRes = await request(app)
    .get("/api/audit-logs?entityType=import_batch")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(auditRes.status, 200);
  assert.ok(auditRes.body.some((row: { action: string }) => row.action === "create"));

  const dupRes = await request(app)
    .post(`/api/import/bank-transactions?accountId=${accountRes.body.id}&bank=mbank`)
    .set("Authorization", `Bearer ${token}`)
    .send({ csv });
  assert.equal(dupRes.body.skipped, 2);
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

test("POST /api/import/broker-trades rejects unsupported broker", async () => {
  const { token } = await createUserAndToken();
  const accountRes = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountType: "BROKERAGE",
      name: "Import Broker",
      currency: "PLN",
      openingBalance: 0,
    });
  const res = await request(app)
    .post(`/api/import/broker-trades?accountId=${accountRes.body.id}&broker=ibkr`)
    .set("Authorization", `Bearer ${token}`)
    .send({ csv: "Symbol;Volume\nAAPL;1" });
  assert.equal(res.status, 400);
});

test("POST /api/import/broker-trades dry-run previews XTB CSV", async () => {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { token } = await createUserAndToken();
  const accountRes = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      accountType: "BROKERAGE",
      name: "Import Broker",
      currency: "PLN",
      openingBalance: 0,
    });
  const csv = readFileSync(
    join(__dirname, "fixtures", "import", "xtb-closed-positions.csv"),
    "utf8",
  );
  const res = await request(app)
    .post(`/api/import/broker-trades?accountId=${accountRes.body.id}&dryRun=true&broker=xtb`)
    .set("Authorization", `Bearer ${token}`)
    .send({ csv, filename: "xtb-closed-positions.csv" });
  assert.equal(res.status, 200);
  assert.equal(res.body.dryRun, true);
  assert.equal(res.body.parsed, 3);
  assert.equal(res.body.preview.length, 3);
});

test("GET /api/stats/tax-report returns annual summary", async () => {
  const { token, userId } = await createUserAndToken();
  const account = await prisma.account.create({
    data: {
      userId,
      accountType: "BROKERAGE",
      name: "Tax Broker",
      currency: "PLN",
      openingBalance: 0,
      cashBalance: 0,
    },
  });
  const instrument = await prisma.instrument.create({
    data: { instrumentType: "STOCK", symbol: "TAX", exchange: "GPW", currency: "PLN" },
  });
  const holding = await prisma.holding.create({
    data: { accountId: account.id, instrumentId: instrument.id, quantity: 0 },
  });
  await prisma.holdingLot.create({
    data: {
      holdingId: holding.id,
      side: "BUY",
      quantity: 2,
      quantityAfter: 2,
      totalPrice: 200,
      pricePerUnit: 100,
      currency: "PLN",
      tradeDate: new Date("2024-01-01T12:00:00.000Z"),
    },
  });
  await prisma.holdingLot.create({
    data: {
      holdingId: holding.id,
      side: "SELL",
      quantity: 2,
      quantityAfter: 0,
      totalPrice: 240,
      pricePerUnit: 120,
      currency: "PLN",
      tradeDate: new Date("2025-02-01T12:00:00.000Z"),
    },
  });

  const res = await request(app)
    .get("/api/stats/tax-report?year=2025&currency=PLN")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.taxYear, 2025);
  assert.equal(res.body.netRealized, 40);
  assert.equal(res.body.estimatedBelka, 7.6);

  const csvRes = await request(app)
    .get("/api/stats/tax-report/export?year=2025&format=csv")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(csvRes.status, 200);
  assert.match(csvRes.headers["content-type"] ?? "", /text\/csv/);
  assert.ok(String(csvRes.text).includes("saleDate,symbol,account"));
});

test("GET /api/stats/tax-report rejects invalid year", async () => {
  const { token } = await createUserAndToken();
  const res = await request(app)
    .get("/api/stats/tax-report?year=abc")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 400);
  assert.match(res.body.error ?? "", /year must be/);
});

test("GET /api/stats/tax-report/export rejects non-csv format", async () => {
  const { token } = await createUserAndToken();
  const res = await request(app)
    .get("/api/stats/tax-report/export?year=2025&format=pdf")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 400);
  assert.match(res.body.error ?? "", /format must be csv/);
});

test("GET /api/stats/tax-report/export rejects invalid year", async () => {
  const { token } = await createUserAndToken();
  const res = await request(app)
    .get("/api/stats/tax-report/export?year=1999&format=csv")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 400);
  assert.match(res.body.error ?? "", /year must be/);
});
