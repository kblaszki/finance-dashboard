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

async function registerAndLogin(
  email: string,
  username: string,
  password: string,
): Promise<string> {
  return registerAndLoginHarness(suite, email, username, password);
}

test("GET /api/accounts returns 401 without token", async () => {
  const res = await request(app).get("/api/accounts");
  assert.equal(res.status, 401);
});

test("POST /api/accounts creates BANK account with totalBalance", async () => {
  const { token } = await createUserAndToken();
  const res = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "Checking",
      currency: "pln",
      openingBalance: 100.5,
      description: "Main bank",
    });
  assert.equal(res.status, 201);
  assert.equal(res.body.accountType, "BANK");
  assert.equal(res.body.name, "Checking");
  assert.equal(res.body.currency, "PLN");
  assert.equal(res.body.cashBalance, 100.5);
  assert.equal(res.body.openingBalance, 100.5);
  assert.equal(res.body.totalBalance, 100.5);
  assert.equal(res.body.description, "Main bank");
});

test("POST /api/accounts creates each allowed accountType", async () => {
  const { token } = await createUserAndToken();
  const types = [
    "BANK",
    "BROKERAGE",
    "CRYPTO",
    "PRECIOUS_METAL",
    "REAL_ESTATE",
    "CREDIT_CARD",
    "IKE",
    "IKZE",
    "TREASURY_BONDS",
    "OTHER",
    "MANUAL",
  ];
  for (const accountType of types) {
    const res = await request(app)
      .post("/api/accounts")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `Acct-${accountType}`, accountType, openingBalance: 1 });
    assert.equal(res.status, 201, accountType);
    assert.equal(res.body.accountType, accountType);
  }
});

test("POST /api/accounts normalizes accountType case", async () => {
  const { token } = await createUserAndToken();
  const res = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Broker Case", accountType: "brokerage" });
  assert.equal(res.status, 201);
  assert.equal(res.body.accountType, "BROKERAGE");
});

test("POST /api/accounts rejects unknown accountType", async () => {
  const { token } = await createUserAndToken();
  const res = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Bad Type", accountType: "FOO" });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /accountType/i);
});

test("POST /api/accounts rejects unsupported currency", async () => {
  const { token } = await createUserAndToken();
  const res = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "GBP Acct", currency: "GBP" });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /FX currency must be/i);
});

test("POST /api/accounts rejects duplicate name for same user", async () => {
  const { token } = await createUserAndToken();
  const first = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Dup" });
  assert.equal(first.status, 201);
  const second = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Dup" });
  assert.equal(second.status, 400);
  assert.match(second.body.error, /already exists/i);
});

test("GET /api/accounts lists own accounts newest first", async () => {
  const { token } = await createUserAndToken();
  await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Older", openingBalance: 10 });
  await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Newer", openingBalance: 20 });
  const res = await request(app).get("/api/accounts").set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 2);
  assert.equal(res.body[0].name, "Newer");
  assert.equal(res.body[0].totalBalance, 20);
  assert.equal(res.body[1].name, "Older");
});

test("GET/PATCH/DELETE /api/accounts/:id scoped to owner", async () => {
  const { token } = await createUserAndToken();
  const otherToken = await registerAndLogin("other@test.local", "otheruser", "password123");
  const created = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Mine", currency: "EUR", openingBalance: 50 });
  assert.equal(created.status, 201);
  const id = created.body.id as number;

  const getOwn = await request(app)
    .get(`/api/accounts/${id}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(getOwn.status, 200);
  assert.equal(getOwn.body.name, "Mine");

  const getOther = await request(app)
    .get(`/api/accounts/${id}`)
    .set("Authorization", `Bearer ${otherToken}`);
  assert.equal(getOther.status, 404);

  const patchOther = await request(app)
    .patch(`/api/accounts/${id}`)
    .set("Authorization", `Bearer ${otherToken}`)
    .send({ name: "Hijacked" });
  assert.equal(patchOther.status, 404);

  const patchOwn = await request(app)
    .patch(`/api/accounts/${id}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Renamed", description: "Updated", currency: "usd" });
  assert.equal(patchOwn.status, 200);
  assert.equal(patchOwn.body.name, "Renamed");
  assert.equal(patchOwn.body.description, "Updated");
  assert.equal(patchOwn.body.currency, "USD");
  assert.equal(patchOwn.body.cashBalance, 50);

  const deleteOther = await request(app)
    .delete(`/api/accounts/${id}`)
    .set("Authorization", `Bearer ${otherToken}`);
  assert.equal(deleteOther.status, 404);

  const deleteOwn = await request(app)
    .delete(`/api/accounts/${id}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(deleteOwn.status, 204);

  const getGone = await request(app)
    .get(`/api/accounts/${id}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(getGone.status, 404);
});

test("PATCH /api/accounts/:id locks currency once transactions exist", async () => {
  const { token } = await createUserAndToken();
  const created = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Lock", currency: "PLN", openingBalance: 10 });
  assert.equal(created.status, 201);
  const id = created.body.id as number;

  const emptyChange = await request(app)
    .patch(`/api/accounts/${id}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ currency: "eur" });
  assert.equal(emptyChange.status, 200);
  assert.equal(emptyChange.body.currency, "EUR");

  const back = await request(app)
    .patch(`/api/accounts/${id}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ currency: "PLN" });
  assert.equal(back.status, 200);

  const invalid = await request(app)
    .patch(`/api/accounts/${id}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ currency: "US" });
  assert.equal(invalid.status, 400);

  const posted = await request(app)
    .post(`/api/accounts/${id}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "INCOME", amount: 1 });
  assert.equal(posted.status, 201);

  const same = await request(app)
    .patch(`/api/accounts/${id}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ currency: "pln" });
  assert.equal(same.status, 200);
  assert.equal(same.body.currency, "PLN");

  const locked = await request(app)
    .patch(`/api/accounts/${id}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ currency: "USD" });
  assert.equal(locked.status, 409);
  assert.match(locked.body.error, /currency/i);
});

test("PATCH /api/accounts/:id ignores accountType", async () => {
  const { token } = await createUserAndToken();
  const created = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Typed", accountType: "CRYPTO", openingBalance: 5 });
  assert.equal(created.status, 201);
  const id = created.body.id as number;

  const patched = await request(app)
    .patch(`/api/accounts/${id}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Typed Renamed", accountType: "BANK" });
  assert.equal(patched.status, 200);
  assert.equal(patched.body.name, "Typed Renamed");
  assert.equal(patched.body.accountType, "CRYPTO");
});

test("GET /api/accounts/:id/balance-history returns flat opening and scopes ownership", async () => {
  const { token } = await createUserAndToken();
  const otherToken = await registerAndLogin("balother@test.local", "balother", "password123");
  const account = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "BalHist",
      openingBalance: 250,
      openingCashAsOf: "2025-01-01T00:00:00.000Z",
    });
  assert.equal(account.status, 201);
  const accountId = account.body.id as number;

  const empty = await request(app)
    .get(`/api/accounts/${accountId}/balance-history?month=2026-01&months=6`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(empty.status, 200);
  assert.equal(empty.body.accountId, accountId);
  assert.equal(empty.body.currency, "PLN");
  assert.equal(empty.body.monthCount, 6);
  assert.equal(empty.body.series.length, 6);
  assert.equal(empty.body.series[0].month, "2025-08");
  assert.equal(empty.body.series[5].month, "2026-01");
  assert.ok(empty.body.series.every((p: { balance: number }) => p.balance === 250));

  const forbidden = await request(app)
    .get(`/api/accounts/${accountId}/balance-history?month=2026-01`)
    .set("Authorization", `Bearer ${otherToken}`);
  assert.equal(forbidden.status, 404);

  const badMonths = await request(app)
    .get(`/api/accounts/${accountId}/balance-history?month=2026-01&months=5`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(badMonths.status, 400);
});

test("GET /api/accounts/:id/balance-history aggregates end-of-month cash balances", async () => {
  const { token } = await createUserAndToken();
  const account = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "BalAgg",
      openingBalance: 100,
      openingCashAsOf: "2025-01-01T00:00:00.000Z",
    });
  assert.equal(account.status, 201);
  const accountId = account.body.id as number;

  await request(app)
    .post(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "INCOME", amount: 50, occurredAt: "2025-12-10T00:00:00.000Z" });
  await request(app)
    .post(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "EXPENSE", amount: 20, occurredAt: "2026-01-15T00:00:00.000Z" });

  const res = await request(app)
    .get(`/api/accounts/${accountId}/balance-history?month=2026-01&months=6`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.monthCount, 6);
  const byMonth = new Map(
    (res.body.series as { month: string; balance: number }[]).map((p) => [p.month, p.balance]),
  );
  assert.equal(byMonth.get("2025-11"), 100);
  assert.equal(byMonth.get("2025-12"), 150);
  assert.equal(byMonth.get("2026-01"), 130);
});

test("POST /api/accounts/:id/transactions updates cashBalance for INCOME and EXPENSE", async () => {
  const { token } = await createUserAndToken();
  const account = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Ledger", openingBalance: 100 });
  assert.equal(account.status, 201);
  const accountId = account.body.id as number;

  const income = await request(app)
    .post(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "INCOME", amount: 25, description: "Pay" });
  assert.equal(income.status, 201);
  assert.equal(income.body.type, "INCOME");
  assert.equal(income.body.amount, 25);
  assert.ok(income.body.occurredAt);

  const afterIncome = await request(app)
    .get(`/api/accounts/${accountId}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(afterIncome.body.cashBalance, 125);

  const expense = await request(app)
    .post(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "expense", amount: 40 });
  assert.equal(expense.status, 201);
  assert.equal(expense.body.type, "EXPENSE");

  const afterExpense = await request(app)
    .get(`/api/accounts/${accountId}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(afterExpense.body.cashBalance, 85);
});

test("POST /api/accounts/:id/transactions stores decimal cents without binary float drift", async () => {
  const { token } = await createUserAndToken();
  const account = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Cents", openingBalance: 0 });
  assert.equal(account.status, 201);
  const accountId = account.body.id as number;

  for (const amount of [0.1, 0.2]) {
    const created = await request(app)
      .post(`/api/accounts/${accountId}/transactions`)
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "INCOME", amount });
    assert.equal(created.status, 201);
  }

  const after = await request(app)
    .get(`/api/accounts/${accountId}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(JSON.stringify(after.body.cashBalance), "0.3");
  assert.equal(JSON.stringify(after.body.openingBalance), "0");

  const rejected = await request(app)
    .post(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "INCOME", amount: 0.001 });
  assert.equal(rejected.status, 400);
});

test("GET /api/accounts/:id/transactions lists newest first and scopes ownership", async () => {
  const { token } = await createUserAndToken();
  const otherToken = await registerAndLogin("txother@test.local", "txother", "password123");
  const account = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "ListTx", openingBalance: 10 });
  const accountId = account.body.id as number;

  await request(app)
    .post(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "INCOME", amount: 1, occurredAt: "2024-01-01T00:00:00.000Z" });
  await request(app)
    .post(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "EXPENSE", amount: 2, occurredAt: "2024-06-01T00:00:00.000Z" });

  const list = await request(app)
    .get(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(list.status, 200);
  assert.equal(list.body.items.length, 2);
  assert.equal(list.body.items[0].type, "EXPENSE");
  assert.equal(list.body.items[1].type, "INCOME");

  const forbidden = await request(app)
    .get(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${otherToken}`);
  assert.equal(forbidden.status, 404);

  const june = await request(app)
    .get(`/api/accounts/${accountId}/transactions?month=2024-06`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(june.status, 200);
  assert.equal(june.body.items.length, 1);
  assert.equal(june.body.items[0].type, "EXPENSE");
  assert.equal(june.body.nextCursor, null);

  const page = await request(app)
    .get(`/api/accounts/${accountId}/transactions?limit=1`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(page.status, 200);
  assert.equal(page.body.items.length, 1);
  assert.ok(page.body.nextCursor);
  const page2 = await request(app)
    .get(
      `/api/accounts/${accountId}/transactions?limit=1&cursor=${encodeURIComponent(page.body.nextCursor)}`,
    )
    .set("Authorization", `Bearer ${token}`);
  assert.equal(page2.status, 200);
  assert.equal(page2.body.items.length, 1);
  assert.equal(page2.body.items[0].type, "INCOME");
  assert.equal(page2.body.nextCursor, null);
});

test("GET /api/accounts/:id/transactions/export returns CSV with auth and ownership", async () => {
  const token = await registerAndLogin("csvuser@test.local", "csvuser", "password123");
  const otherToken = await registerAndLogin(
    "csvother@test.local",
    "csvother",
    "password123",
  );

  const unauth = await request(app).get("/api/accounts/1/transactions/export");
  assert.equal(unauth.status, 401);

  const badId = await request(app)
    .get("/api/accounts/not-a-number/transactions/export")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(badId.status, 400);

  const brokerage = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "Broker CSV",
      accountType: "BROKERAGE",
      currency: "EUR",
      openingBalance: 0,
    });
  assert.equal(brokerage.status, 201);
  const accountId = brokerage.body.id as number;

  const empty = await request(app)
    .get(`/api/accounts/${accountId}/transactions/export`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(empty.status, 200);
  assert.match(String(empty.headers["content-type"]), /text\/csv/);
  assert.equal(
    empty.headers["content-disposition"],
    `attachment; filename="account-${accountId}-cash.csv"`,
  );
  assert.equal(
    empty.text,
    "id,type,amount,currency,occurredAt,description,categoryPath,createdAt\n",
  );

  const cats = await request(app)
    .get("/api/categories")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(cats.status, 200);
  const salary = (cats.body as Array<{ id: number; name: string }>).find(
    (c) => c.name === "Salary",
  );
  assert.ok(salary);

  await request(app)
    .post(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      type: "INCOME",
      amount: 100.5,
      occurredAt: "2024-06-15T12:00:00.000Z",
      description: "Pay, bonus",
      categoryId: salary!.id,
    });
  await request(app)
    .post(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      type: "EXPENSE",
      amount: 10,
      occurredAt: "2024-01-01T00:00:00.000Z",
      description: "=1+1",
    });

  const exported = await request(app)
    .get(`/api/accounts/${accountId}/transactions/export`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(exported.status, 200);
  const lines = exported.text.trimEnd().split("\n");
  assert.equal(
    lines[0],
    "id,type,amount,currency,occurredAt,description,categoryPath,createdAt",
  );
  assert.equal(lines.length, 3);
  assert.match(lines[1]!, /^[0-9]+,EXPENSE,10\.00,EUR,/);
  assert.match(lines[1]!, /,'=1\+1,,/);
  assert.match(lines[2]!, /,INCOME,100\.50,EUR,/);
  assert.match(lines[2]!, /,"Pay, bonus",Salary,/);

  const forbidden = await request(app)
    .get(`/api/accounts/${accountId}/transactions/export`)
    .set("Authorization", `Bearer ${otherToken}`);
  assert.equal(forbidden.status, 404);
});

test("DELETE /api/accounts/:id/transactions/:txId reverses cashBalance", async () => {
  const { token } = await createUserAndToken();
  const account = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Rev", openingBalance: 50 });
  const accountId = account.body.id as number;

  const income = await request(app)
    .post(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "INCOME", amount: 30 });
  const txId = income.body.id as number;

  const deleted = await request(app)
    .delete(`/api/accounts/${accountId}/transactions/${txId}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(deleted.status, 204);

  const after = await request(app)
    .get(`/api/accounts/${accountId}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(after.body.cashBalance, 50);

  const list = await request(app)
    .get(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(list.body.items.length, 0);
});

test("PATCH /api/accounts/:id/transactions/:txId adjusts cashBalance", async () => {
  const { token } = await createUserAndToken();
  const otherToken = await registerAndLogin("txpatch@test.local", "txpatch", "password123");
  const account = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Edit", openingBalance: 100 });
  const accountId = account.body.id as number;

  const expense = await request(app)
    .post(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      type: "EXPENSE",
      amount: 40,
      occurredAt: "2024-01-31T23:00:00.000Z",
      description: "Old",
    });
  assert.equal(expense.status, 201);
  const txId = expense.body.id as number;

  const empty = await request(app)
    .patch(`/api/accounts/${accountId}/transactions/${txId}`)
    .set("Authorization", `Bearer ${token}`)
    .send({});
  assert.equal(empty.status, 400);

  const patched = await request(app)
    .patch(`/api/accounts/${accountId}/transactions/${txId}`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      type: "INCOME",
      amount: 10.5,
      occurredAt: "2024-02-01T00:00:00.000Z",
      description: "New",
    });
  assert.equal(patched.status, 200);
  assert.equal(patched.body.type, "INCOME");
  assert.equal(patched.body.amount, 10.5);
  assert.equal(patched.body.occurredAt, "2024-02-01T00:00:00.000Z");
  assert.equal(patched.body.description, "New");

  const after = await request(app)
    .get(`/api/accounts/${accountId}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(after.body.cashBalance, 110.5);

  const foreign = await request(app)
    .patch(`/api/accounts/${accountId}/transactions/${txId}`)
    .set("Authorization", `Bearer ${otherToken}`)
    .send({ description: "Nope" });
  assert.equal(foreign.status, 404);
});

test("cash transactions reject invalid input and mismatched account", async () => {
  const { token } = await createUserAndToken();
  const a = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "A1", openingBalance: 10 });
  const b = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "A2", openingBalance: 10 });
  const accountId = a.body.id as number;
  const otherAccountId = b.body.id as number;

  const zero = await request(app)
    .post(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "INCOME", amount: 0 });
  assert.equal(zero.status, 400);

  const badType = await request(app)
    .post(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "TRANSFER", amount: 5 });
  assert.equal(badType.status, 400);

  const created = await request(app)
    .post(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "INCOME", amount: 5 });
  const txId = created.body.id as number;

  const wrongAccount = await request(app)
    .delete(`/api/accounts/${otherAccountId}/transactions/${txId}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(wrongAccount.status, 404);

  const missing = await request(app)
    .delete(`/api/accounts/${accountId}/transactions/999999`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(missing.status, 404);
});

test("account name and description reject oversized text", async () => {
  const { token } = await createUserAndToken();
  const longName = "n".repeat(101);
  const created = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: longName });
  assert.equal(created.status, 400);

  const account = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Ok name" });
  const described = await request(app)
    .patch(`/api/accounts/${account.body.id}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ description: "d".repeat(501) });
  assert.equal(described.status, 400);

  const tx = await request(app)
    .post(`/api/accounts/${account.body.id}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "INCOME", amount: 1, description: "d".repeat(501) });
  assert.equal(tx.status, 400);
});
