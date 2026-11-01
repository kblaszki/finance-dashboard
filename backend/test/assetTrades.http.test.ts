import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import { utcDateFromYmd } from "../src/domain/fx";
import { VALUATION_SOURCE_YAHOO } from "../src/domain/instrumentValuations";
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

async function seedInstrument(currency = "USD") {
  return prisma.instrument.create({
    data: {
      symbol: "AAPL",
      name: "Apple",
      currency,
      assetClass: "STOCK",
      provider: "twelve_data",
      providerSymbol: `AAPL-${currency}`,
      allowlisted: true,
    },
  });
}

test("asset trade IDOR returns 404 for foreign account", async () => {
  const a = await createUserAndToken();
  const bToken = await registerAndLoginHarness(
    suite,
    "other@test.local",
    "otheruser",
    "testpass123",
  );
  const account = await prisma.account.create({
    data: {
      userId: a.userId,
      accountType: "BROKERAGE",
      name: "Broker A",
      currency: "USD",
      cashBalance: 100_000,
      openingBalance: 100_000,
    },
  });
  const res = await request(app)
    .get(`/api/accounts/${account.id}/holdings`)
    .set("Authorization", `Bearer ${bToken}`);
  assert.equal(res.status, 404);
});

test("POST BUY/SELL updates cash holdings equity; stats ignore ASSET_*", async () => {
  const { token, userId } = await createUserAndToken();
  const instrument = await seedInstrument("USD");
  await prisma.instrumentValuation.create({
    data: {
      instrumentId: instrument.id,
      asOfDate: utcDateFromYmd("2026-01-15"),
      close: 110,
      source: VALUATION_SOURCE_YAHOO,
    },
  });

  const created = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "Broker USD",
      accountType: "BROKERAGE",
      currency: "USD",
      openingBalance: 2000,
    });
  assert.equal(created.status, 201);
  const accountId = created.body.id as number;

  const buy = await request(app)
    .post(`/api/accounts/${accountId}/asset-trades`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      instrumentId: instrument.id,
      side: "BUY",
      quantity: 10,
      unitPrice: 100,
      commission: 5,
      occurredAt: "2026-01-10T12:00:00.000Z",
    });
  assert.equal(buy.status, 201, JSON.stringify(buy.body));
  assert.equal(buy.body.side, "BUY");

  const holdings = await request(app)
    .get(`/api/accounts/${accountId}/holdings`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(holdings.status, 200);
  assert.equal(holdings.body.holdings.length, 1);
  assert.equal(holdings.body.holdings[0].quantity, 10);
  assert.equal(holdings.body.holdingsValue, 1100);

  const detail = await request(app)
    .get(`/api/accounts/${accountId}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.cashBalance, 995);
  assert.equal(detail.body.holdingsValue, 1100);
  assert.equal(detail.body.totalEquity, 2095);

  const sell = await request(app)
    .post(`/api/accounts/${accountId}/asset-trades`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      instrumentId: instrument.id,
      side: "SELL",
      quantity: 4,
      unitPrice: 120,
      commission: 2,
      occurredAt: "2026-01-20T12:00:00.000Z",
    });
  assert.equal(sell.status, 201);

  const afterSell = await request(app)
    .get(`/api/accounts/${accountId}/holdings`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(afterSell.body.holdings[0].quantity, 6);
  // 6 * 110 = 660
  assert.equal(afterSell.body.holdingsValue, 660);

  await prisma.fxRateDaily.create({
    data: {
      rateDate: utcDateFromYmd("2026-01-20"),
      currency: "USD",
      mid: 4,
    },
  });

  const nw = await request(app)
    .get("/api/statistics/net-worth")
    .query({ currency: "PLN" })
    .set("Authorization", `Bearer ${token}`);
  assert.equal(nw.status, 200);
  // cash 995+478=1473; holdings 660; total USD 2133 * 4 = 8532 PLN in stock bucket
  assert.equal(nw.body.byBucket.stock, 8532);

  const summary = await request(app)
    .get("/api/statistics/period-summary")
    .query({ currency: "USD", month: "2026-01" })
    .set("Authorization", `Bearer ${token}`);
  assert.equal(summary.status, 200);
  assert.equal(summary.body.income, 0);
  assert.equal(summary.body.expense, 0);
});

test("DELETE asset trade reverses BUY when unsold", async () => {
  const { token } = await createUserAndToken();
  const instrument = await seedInstrument("USD");
  const created = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "Broker Del",
      accountType: "BROKERAGE",
      currency: "USD",
      openingBalance: 500,
    });
  const accountId = created.body.id as number;

  const buy = await request(app)
    .post(`/api/accounts/${accountId}/asset-trades`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      instrumentId: instrument.id,
      side: "BUY",
      quantity: 1,
      unitPrice: 100,
      commission: 0,
    });
  assert.equal(buy.status, 201, JSON.stringify(buy.body));

  const del = await request(app)
    .delete(`/api/accounts/${accountId}/asset-trades/${buy.body.id}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(del.status, 204);

  const detail = await request(app)
    .get(`/api/accounts/${accountId}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(detail.body.cashBalance, 500);
});

test("BANK account rejects asset trades", async () => {
  const { token } = await createUserAndToken();
  const instrument = await seedInstrument("PLN");
  const created = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Bank", accountType: "BANK", currency: "PLN", openingBalance: 1000 });
  const res = await request(app)
    .post(`/api/accounts/${created.body.id}/asset-trades`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      instrumentId: instrument.id,
      side: "BUY",
      quantity: 1,
      unitPrice: 10,
    });
  assert.equal(res.status, 400);
});
