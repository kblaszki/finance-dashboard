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

test("GET /api/statistics/category-breakdown requires auth and valid month", async () => {
  const noAuth = await request(app).get("/api/statistics/category-breakdown?month=2026-08");
  assert.equal(noAuth.status, 401);

  const token = await registerAndLogin("statsauth@test.local", "statsauth", "password123");

  const missing = await request(app)
    .get("/api/statistics/category-breakdown")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(missing.status, 400);

  const badMonth = await request(app)
    .get("/api/statistics/category-breakdown?month=2024-13")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(badMonth.status, 400);

  const shortMonth = await request(app)
    .get("/api/statistics/category-breakdown?month=2024-1")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(shortMonth.status, 400);
});

test("GET /api/statistics/category-breakdown aggregates by category and currency", async () => {
  const token = await registerAndLogin("statsagg@test.local", "statsagg", "password123");
  const otherToken = await registerAndLogin("statsother@test.local", "statsother", "password123");

  const cats = await request(app)
    .get("/api/categories")
    .set("Authorization", `Bearer ${token}`);
  const salary = (cats.body as Array<{ id: number; name: string }>).find((c) => c.name === "Salary")!;
  const food = (cats.body as Array<{ id: number; name: string }>).find((c) => c.name === "Food")!;
  assert.ok(salary);
  assert.ok(food);

  const plnA = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "PLN-A", currency: "PLN", openingBalance: 0 });
  const plnB = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "PLN-B", currency: "PLN", openingBalance: 0 });
  const eur = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "EUR-A", currency: "EUR", openingBalance: 0 });
  const otherAccount = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${otherToken}`)
    .send({ name: "Other", currency: "PLN", openingBalance: 0 });

  const plnAId = plnA.body.id as number;
  const plnBId = plnB.body.id as number;
  const eurId = eur.body.id as number;
  const otherId = otherAccount.body.id as number;

  await request(app)
    .post(`/api/accounts/${plnAId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      type: "INCOME",
      amount: 3000,
      categoryId: salary.id,
      occurredAt: "2026-08-01T00:00:00.000Z",
    });
  await request(app)
    .post(`/api/accounts/${plnBId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      type: "INCOME",
      amount: 2000,
      categoryId: salary.id,
      occurredAt: "2026-08-15T12:00:00.000Z",
    });
  await request(app)
    .post(`/api/accounts/${plnAId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      type: "EXPENSE",
      amount: 40,
      categoryId: food.id,
      occurredAt: "2026-08-10T00:00:00.000Z",
    });
  await request(app)
    .post(`/api/accounts/${plnAId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      type: "EXPENSE",
      amount: 12.5,
      occurredAt: "2026-08-20T00:00:00.000Z",
    });
  await request(app)
    .post(`/api/accounts/${eurId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      type: "EXPENSE",
      amount: 25,
      categoryId: food.id,
      occurredAt: "2026-08-11T00:00:00.000Z",
    });
  // Outside month (next month start) — excluded
  await request(app)
    .post(`/api/accounts/${plnAId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      type: "EXPENSE",
      amount: 999,
      categoryId: food.id,
      occurredAt: "2026-09-01T00:00:00.000Z",
    });
  // Other user — excluded
  await request(app)
    .post(`/api/accounts/${otherId}/transactions`)
    .set("Authorization", `Bearer ${otherToken}`)
    .send({
      type: "EXPENSE",
      amount: 50,
      occurredAt: "2026-08-05T00:00:00.000Z",
    });

  const res = await request(app)
    .get("/api/statistics/category-breakdown?month=2026-08")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.month, "2026-08");
  assert.equal(res.body.period, "month");
  assert.equal(res.body.label, "2026-08");
  assert.ok(Array.isArray(res.body.income));
  assert.ok(Array.isArray(res.body.expense));
  assert.ok(Array.isArray(res.body.transfer));

  assert.equal(res.body.income.length, 1);
  assert.equal(res.body.income[0].categoryId, salary.id);
  assert.equal(res.body.income[0].categoryName, "Salary");
  assert.equal(res.body.income[0].currency, "PLN");
  assert.equal(res.body.income[0].total, 5000);
  assert.equal(res.body.income[0].count, 2);

  assert.equal(res.body.expense.length, 3);
  const foodPln = res.body.expense.find(
    (r: { categoryId: number | null; currency: string }) =>
      r.categoryId === food.id && r.currency === "PLN",
  );
  const foodEur = res.body.expense.find(
    (r: { categoryId: number | null; currency: string }) =>
      r.categoryId === food.id && r.currency === "EUR",
  );
  const uncat = res.body.expense.find(
    (r: { categoryId: number | null; categoryName: string }) =>
      r.categoryId === null && r.categoryName === "Uncategorized",
  );
  assert.ok(foodPln);
  assert.equal(foodPln.total, 40);
  assert.equal(foodPln.count, 1);
  assert.ok(foodEur);
  assert.equal(foodEur.total, 25);
  assert.ok(uncat);
  assert.equal(uncat.total, 12.5);
  assert.equal(uncat.currency, "PLN");

  // Sorted by total desc: Food PLN 40, Food EUR 25, Uncategorized 12.5
  assert.equal(res.body.expense[0].total, 40);
  assert.equal(res.body.expense[1].total, 25);
  assert.equal(res.body.expense[2].total, 12.5);

  const empty = await request(app)
    .get("/api/statistics/category-breakdown?month=2025-01")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(empty.status, 200);
  assert.deepEqual(empty.body.income, []);
  assert.deepEqual(empty.body.expense, []);
  assert.deepEqual(empty.body.transfer, []);
});

test("GET /api/statistics/period-summary requires auth and valid params", async () => {
  const noAuth = await request(app).get(
    "/api/statistics/period-summary?month=2026-08&currency=PLN",
  );
  assert.equal(noAuth.status, 401);

  const token = await registerAndLogin("sumauth@test.local", "sumauth", "password123");

  const missingMonth = await request(app)
    .get("/api/statistics/period-summary?currency=PLN")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(missingMonth.status, 400);

  const missingCurrency = await request(app)
    .get("/api/statistics/period-summary?month=2026-08")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(missingCurrency.status, 400);

  const badCurrency = await request(app)
    .get("/api/statistics/period-summary?month=2026-08&currency=US")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(badCurrency.status, 400);
});

test("GET /api/statistics/period-summary aggregates all currencies with NBP FX and tenancy", async () => {
  const token = await registerAndLogin("sumagg@test.local", "sumagg", "password123");
  const otherToken = await registerAndLogin("sumother@test.local", "sumother", "password123");

  await prisma.fxRateDaily.createMany({
    data: [
      { currency: "EUR", rateDate: new Date("2026-08-11T00:00:00.000Z"), mid: 4 },
      { currency: "USD", rateDate: new Date("2026-08-05T00:00:00.000Z"), mid: 4 },
    ],
  });

  const pln = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Sum PLN", currency: "PLN", openingBalance: 0 });
  const eur = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Sum EUR", currency: "EUR", openingBalance: 0 });
  const otherAccount = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${otherToken}`)
    .send({ name: "Other Sum", currency: "PLN", openingBalance: 0 });

  const plnId = pln.body.id as number;
  const eurId = eur.body.id as number;
  const otherId = otherAccount.body.id as number;

  await request(app)
    .post(`/api/accounts/${plnId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "INCOME", amount: 3000, occurredAt: "2026-08-05T00:00:00.000Z" });
  await request(app)
    .post(`/api/accounts/${plnId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "EXPENSE", amount: 400, occurredAt: "2026-08-10T00:00:00.000Z" });
  await request(app)
    .post(`/api/accounts/${eurId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "EXPENSE", amount: 50, occurredAt: "2026-08-11T00:00:00.000Z" });
  await request(app)
    .post(`/api/accounts/${otherId}/transactions`)
    .set("Authorization", `Bearer ${otherToken}`)
    .send({ type: "EXPENSE", amount: 99, occurredAt: "2026-08-08T00:00:00.000Z" });

  const res = await request(app)
    .get("/api/statistics/period-summary?month=2026-08&currency=PLN")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, {
    month: "2026-08",
    period: "month",
    label: "2026-08",
    currency: "PLN",
    income: 3000,
    expense: 600,
    net: 2400,
    transfers: 0,
  });

  const inUsd = await request(app)
    .get("/api/statistics/period-summary?month=2026-08&currency=USD")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(inUsd.status, 200);
  assert.equal(inUsd.body.currency, "USD");
  assert.equal(inUsd.body.income, 750);
  assert.equal(inUsd.body.expense, 150);
  assert.equal(inUsd.body.net, 600);
});

test("GET /api/statistics/period-summary fails when required FX mid is missing", async () => {
  const token = await registerAndLogin("summiss@test.local", "summiss", "password123");
  const eur = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Need EUR mid", currency: "EUR", openingBalance: 0 });
  await request(app)
    .post(`/api/accounts/${eur.body.id}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "INCOME", amount: 10, occurredAt: "2026-08-10T00:00:00.000Z" });

  const res = await request(app)
    .get("/api/statistics/period-summary?month=2026-08&currency=PLN")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 404);
  assert.match(res.body.error, /EUR|rate|mid/i);
});

test("GET /api/statistics period=quarter expands bounds and rejects bad period", async () => {
  const token = await registerAndLogin("sumqtr@test.local", "sumqtr", "password123");
  const pln = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Qtr PLN", currency: "PLN", openingBalance: 0 });
  const plnId = pln.body.id as number;

  await request(app)
    .post(`/api/accounts/${plnId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "INCOME", amount: 100, occurredAt: "2026-01-15T00:00:00.000Z" });
  await request(app)
    .post(`/api/accounts/${plnId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "INCOME", amount: 200, occurredAt: "2026-03-20T00:00:00.000Z" });
  await request(app)
    .post(`/api/accounts/${plnId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "INCOME", amount: 50, occurredAt: "2026-04-01T00:00:00.000Z" });

  const badPeriod = await request(app)
    .get("/api/statistics/period-summary?month=2026-02&currency=PLN&period=week")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(badPeriod.status, 400);

  const q1 = await request(app)
    .get("/api/statistics/period-summary?month=2026-02&currency=PLN&period=quarter")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(q1.status, 200);
  assert.equal(q1.body.period, "quarter");
  assert.equal(q1.body.label, "2026 Q1");
  assert.equal(q1.body.income, 300);
  assert.equal(q1.body.expense, 0);
  assert.equal(q1.body.net, 300);
});

test("GET /api/statistics/tag-breakdown aggregates by tag with tenancy", async () => {
  const token = await registerAndLogin("tagstat@test.local", "tagstat", "password123");
  const otherToken = await registerAndLogin(
    "tagstat2@test.local",
    "tagstat2",
    "password123",
  );

  const tag = await request(app)
    .post("/api/tags")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Lidl" });
  assert.equal(tag.status, 201);
  const tagId = tag.body.id as number;

  const pln = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Tag PLN", currency: "PLN", openingBalance: 0 });
  const otherAccount = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${otherToken}`)
    .send({ name: "Other Tag", currency: "PLN", openingBalance: 0 });
  const plnId = pln.body.id as number;
  const otherId = otherAccount.body.id as number;

  await request(app)
    .post(`/api/accounts/${plnId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      type: "EXPENSE",
      amount: 80,
      tagIds: [tagId],
      occurredAt: "2026-08-05T00:00:00.000Z",
    });
  await request(app)
    .post(`/api/accounts/${plnId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      type: "EXPENSE",
      amount: 20,
      occurredAt: "2026-08-06T00:00:00.000Z",
    });
  await request(app)
    .post(`/api/accounts/${plnId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      type: "INCOME",
      amount: 500,
      tagIds: [tagId],
      occurredAt: "2026-08-07T00:00:00.000Z",
    });
  await request(app)
    .post(`/api/accounts/${otherId}/transactions`)
    .set("Authorization", `Bearer ${otherToken}`)
    .send({
      type: "EXPENSE",
      amount: 99,
      occurredAt: "2026-08-05T00:00:00.000Z",
    });

  const noAuth = await request(app).get(
    "/api/statistics/tag-breakdown?month=2026-08&currency=PLN",
  );
  assert.equal(noAuth.status, 401);

  const missingCurrency = await request(app)
    .get("/api/statistics/tag-breakdown?month=2026-08")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(missingCurrency.status, 400);

  const res = await request(app)
    .get("/api/statistics/tag-breakdown?month=2026-08&currency=PLN")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.period, "month");
  assert.equal(res.body.currency, "PLN");
  assert.equal(res.body.expense.length, 1);
  assert.equal(res.body.expense[0].tagId, tagId);
  assert.equal(res.body.expense[0].total, 80);
  assert.equal(res.body.income[0].total, 500);
  assert.equal(res.body.untagged.expense, 20);
  assert.equal(res.body.untagged.expenseCount, 1);
});

test("GET /api/statistics/cashflow-history validates months and defaults to 12", async () => {
  const token = await registerAndLogin("histauth@test.local", "histauth", "password123");

  const badMonths = await request(app)
    .get("/api/statistics/cashflow-history?month=2026-01&currency=PLN&months=5")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(badMonths.status, 400);

  const missingCurrency = await request(app)
    .get("/api/statistics/cashflow-history?month=2026-01")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(missingCurrency.status, 400);

  const def = await request(app)
    .get("/api/statistics/cashflow-history?month=2026-01&currency=PLN")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(def.status, 200);
  assert.equal(def.body.monthCount, 12);
  assert.equal(def.body.series.length, 12);
  assert.equal(def.body.series[0].month, "2025-02");
  assert.equal(def.body.series[11].month, "2026-01");
  assert.ok(def.body.series.every((p: { income: number; expense: number; net: number }) =>
    p.income === 0 && p.expense === 0 && p.net === 0));
});

test("GET /api/statistics/cashflow-history aggregates series with year span and tenancy", async () => {
  const token = await registerAndLogin("histagg@test.local", "histagg", "password123");
  const otherToken = await registerAndLogin("histother@test.local", "histother", "password123");

  const pln = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Hist PLN", currency: "PLN", openingBalance: 0 });
  const otherAccount = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${otherToken}`)
    .send({ name: "Hist Other", currency: "PLN", openingBalance: 0 });

  const plnId = pln.body.id as number;
  const otherId = otherAccount.body.id as number;

  await request(app)
    .post(`/api/accounts/${plnId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "INCOME", amount: 1000, occurredAt: "2025-12-15T00:00:00.000Z" });
  await request(app)
    .post(`/api/accounts/${plnId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "EXPENSE", amount: 200, occurredAt: "2026-01-10T00:00:00.000Z" });
  await request(app)
    .post(`/api/accounts/${otherId}/transactions`)
    .set("Authorization", `Bearer ${otherToken}`)
    .send({ type: "INCOME", amount: 500, occurredAt: "2026-01-05T00:00:00.000Z" });

  const res = await request(app)
    .get("/api/statistics/cashflow-history?month=2026-01&currency=PLN&months=6")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.currency, "PLN");
  assert.equal(res.body.monthCount, 6);
  assert.equal(res.body.series.length, 6);
  assert.equal(res.body.series[0].month, "2025-08");
  assert.equal(res.body.series[5].month, "2026-01");

  const dec = res.body.series.find((p: { month: string }) => p.month === "2025-12");
  const jan = res.body.series.find((p: { month: string }) => p.month === "2026-01");
  assert.deepEqual(dec, { month: "2025-12", income: 1000, expense: 0, net: 1000 });
  assert.deepEqual(jan, { month: "2026-01", income: 0, expense: 200, net: -200 });
});

test("GET /api/statistics/net-worth requires auth and valid currency", async () => {
  const noAuth = await request(app).get("/api/statistics/net-worth?currency=PLN");
  assert.equal(noAuth.status, 401);

  const token = await registerAndLogin("nwauth@test.local", "nwauth", "password123");

  const missing = await request(app)
    .get("/api/statistics/net-worth")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(missing.status, 400);

  const bad = await request(app)
    .get("/api/statistics/net-worth?currency=US")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(bad.status, 400);
});

test("GET /api/statistics/net-worth aggregates all currencies with NBP FX and tenancy", async () => {
  const token = await registerAndLogin("nwagg@test.local", "nwagg", "password123");
  const otherToken = await registerAndLogin("nwother@test.local", "nwother", "password123");

  const today = new Date();
  const rateDate = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  await prisma.fxRateDaily.createMany({
    data: [
      { currency: "USD", rateDate, mid: 4 },
      { currency: "EUR", rateDate, mid: 4 },
    ],
  });

  await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "NW Bank",
      currency: "PLN",
      accountType: "BANK",
      openingBalance: 1000,
    });
  await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "NW Broker",
      currency: "PLN",
      accountType: "BROKERAGE",
      openingBalance: 2500,
    });
  await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "NW Crypto",
      currency: "USD",
      accountType: "CRYPTO",
      openingBalance: 100,
    });
  await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${otherToken}`)
    .send({
      name: "Other NW",
      currency: "PLN",
      accountType: "BANK",
      openingBalance: 9999,
    });

  const res = await request(app)
    .get("/api/statistics/net-worth?currency=PLN")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.currency, "PLN");
  assert.equal(res.body.byBucket.cash, 1000);
  assert.equal(res.body.byBucket.stock, 2500);
  assert.equal(res.body.byBucket.crypto, 400);
  assert.equal(res.body.liabilities, 0);
  assert.equal(res.body.netWorth, 3900);
  assert.ok(Array.isArray(res.body.ratesUsed));

  await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "NW Card",
      currency: "PLN",
      accountType: "CREDIT_CARD",
      openingBalance: -100,
    });
  await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "NW IKE",
      currency: "PLN",
      accountType: "IKE",
      openingBalance: 400,
    });

  const withCard = await request(app)
    .get("/api/statistics/net-worth?currency=PLN")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(withCard.status, 200);
  assert.equal(withCard.body.liabilities, 100);
  assert.equal(withCard.body.byBucket.stock, 2900);
  assert.equal(withCard.body.netWorth, 3900 + 400 - 100);

  const inEur = await request(app)
    .get("/api/statistics/net-worth?currency=EUR")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(inEur.status, 200);
  assert.equal(inEur.body.currency, "EUR");
  assert.ok(inEur.body.netWorth > 0);
});

test("GET /api/statistics/net-worth-history returns monthly converted series", async () => {
  const token = await registerAndLogin("nwhist@test.local", "nwhist", "password123");
  const today = new Date();
  const rateDate = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  await prisma.fxRateDaily.create({
    data: { currency: "USD", rateDate, mid: 4 },
  });

  await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "Hist PLN",
      currency: "PLN",
      accountType: "BANK",
      openingBalance: 1000,
    });
  await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "Hist USD",
      currency: "USD",
      accountType: "CRYPTO",
      openingBalance: 50,
    });

  const noAuth = await request(app).get(
    "/api/statistics/net-worth-history?currency=PLN&months=6",
  );
  assert.equal(noAuth.status, 401);

  const badMonths = await request(app)
    .get("/api/statistics/net-worth-history?currency=PLN&months=3")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(badMonths.status, 400);

  const future = await request(app)
    .get("/api/statistics/net-worth-history?currency=PLN&month=2099-01")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(future.status, 400);

  const res = await request(app)
    .get("/api/statistics/net-worth-history?currency=PLN&months=6")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.currency, "PLN");
  assert.equal(res.body.monthCount, 6);
  assert.equal(res.body.series.length, 6);
  const last = res.body.series[5];
  assert.equal(last.netWorth, 1000 + 200);
  assert.ok(typeof last.month === "string");
  assert.ok(typeof last.asOf === "string");

  const twelve = await request(app)
    .get("/api/statistics/net-worth-history?currency=PLN&months=12")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(twelve.status, 200);
  assert.equal(twelve.body.monthCount, 12);

  const twentyFour = await request(app)
    .get("/api/statistics/net-worth-history?currency=PLN&months=24")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(twentyFour.status, 200);
  assert.equal(twentyFour.body.monthCount, 24);
});

test("GET /api/statistics/net-worth-history uses oldest tx when openingCashAsOf is unset", async () => {
  const token = await registerAndLogin("nwold@test.local", "nwold", "password123");
  const account = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "Old Ledger",
      currency: "PLN",
      accountType: "BANK",
      openingBalance: 500,
    });
  assert.equal(account.status, 201);

  await request(app)
    .post(`/api/accounts/${account.body.id}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "INCOME", amount: 100, occurredAt: "2025-12-10T00:00:00.000Z" });

  const res = await request(app)
    .get("/api/statistics/net-worth-history?month=2026-01&currency=PLN&months=6")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  const byMonth = new Map(
    (res.body.series as { month: string; netWorth: number }[]).map((p) => [
      p.month,
      p.netWorth,
    ]),
  );
  assert.equal(byMonth.get("2025-11"), 0);
  assert.equal(byMonth.get("2025-12"), 600);
  assert.equal(byMonth.get("2026-01"), 600);
});

test("GET /api/statistics/net-worth fails when required FX mid is missing", async () => {
  const token = await registerAndLogin("nwmiss@test.local", "nwmiss", "password123");
  await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "Need USD mid",
      currency: "USD",
      accountType: "BANK",
      openingBalance: 10,
    });

  const res = await request(app)
    .get("/api/statistics/net-worth?currency=PLN")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 404);
  assert.match(res.body.error, /USD|rate|mid/i);
});

test("GET /api/statistics/cashflow-rolling-12m requires auth and valid currency", async () => {
  const noAuth = await request(app).get(
    "/api/statistics/cashflow-rolling-12m?currency=PLN",
  );
  assert.equal(noAuth.status, 401);

  const token = await registerAndLogin("rollauth@test.local", "rollauth", "password123");

  const missing = await request(app)
    .get("/api/statistics/cashflow-rolling-12m")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(missing.status, 400);

  const bad = await request(app)
    .get("/api/statistics/cashflow-rolling-12m?currency=pl")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(bad.status, 400);

  const empty = await request(app)
    .get("/api/statistics/cashflow-rolling-12m?currency=PLN")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(empty.status, 200);
  assert.equal(empty.body.currency, "PLN");
  assert.equal(empty.body.monthCount, 12);
  assert.ok(typeof empty.body.fromMonth === "string");
  assert.ok(typeof empty.body.toMonth === "string");
  assert.equal(empty.body.avgIncome, 0);
  assert.equal(empty.body.avgExpense, 0);
  assert.equal(empty.body.avgNet, 0);
});
