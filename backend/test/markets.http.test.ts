import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import { INSTRUMENT_PROVIDER_TWELVE_DATA } from "../src/domain/instruments";
import {
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

async function registerAndLogin(
  email: string,
  username: string,
  password: string,
): Promise<string> {
  return registerAndLoginHarness(suite, email, username, password);
}

async function seedInstrument(input?: {
  symbol?: string;
  name?: string;
  assetClass?: string;
}): Promise<number> {
  const symbol = input?.symbol ?? "AAPL";
  const row = await prisma.instrument.create({
    data: {
      symbol,
      name: input?.name ?? "Apple Inc",
      exchange: "NASDAQ",
      currency: "USD",
      assetClass: input?.assetClass ?? "STOCK",
      provider: INSTRUMENT_PROVIDER_TWELVE_DATA,
      providerSymbol: symbol,
    },
  });
  return row.id;
}

test("GET /api/instruments requires auth and q", async () => {
  const noAuth = await request(app).get("/api/instruments?q=aa");
  assert.equal(noAuth.status, 401);

  const token = await registerAndLogin(
    "instauth@test.local",
    "instauth",
    "password123",
  );
  const missingQ = await request(app)
    .get("/api/instruments")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(missingQ.status, 400);
});

test("GET /api/instruments searches local catalog", async () => {
  const token = await registerAndLogin(
    "instsearch@test.local",
    "instsearch",
    "password123",
  );
  await seedInstrument({ symbol: "AAPL", name: "Apple Inc" });
  await seedInstrument({ symbol: "MSFT", name: "Microsoft" });
  await seedInstrument({
    symbol: "VOO",
    name: "Vanguard S&P 500",
    assetClass: "ETF",
  });

  const res = await request(app)
    .get("/api/instruments?q=aap")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 1);
  assert.equal(res.body[0].symbol, "AAPL");

  const etfs = await request(app)
    .get("/api/instruments?q=voo&assetClass=ETF")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(etfs.status, 200);
  assert.equal(etfs.body.length, 1);
  assert.equal(etfs.body[0].assetClass, "ETF");
});

test("watchlist add/list/remove with tenancy and missing price", async () => {
  const prevKey = process.env.TWELVE_DATA_API_KEY;
  delete process.env.TWELVE_DATA_API_KEY;

  const token = await registerAndLogin(
    "wluser@test.local",
    "wluser",
    "password123",
  );
  const otherToken = await registerAndLogin(
    "wlother@test.local",
    "wlother",
    "password123",
  );
  const instrumentId = await seedInstrument();

  try {
  // Quote soft-fails without key; favorite is still created with null close.
  const created = await request(app)
    .post("/api/watchlist")
    .set("Authorization", `Bearer ${token}`)
    .send({ instrumentId });
  assert.equal(created.status, 201);
  assert.equal(created.body.instrumentId, instrumentId);
  assert.equal(created.body.lastClose, null);
  assert.equal(created.body.instrument.symbol, "AAPL");

  const dup = await request(app)
    .post("/api/watchlist")
    .set("Authorization", `Bearer ${token}`)
    .send({ instrumentId });
  assert.equal(dup.status, 409);

  const list = await request(app)
    .get("/api/watchlist")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(list.status, 200);
  assert.equal(list.body.length, 1);

  const otherList = await request(app)
    .get("/api/watchlist")
    .set("Authorization", `Bearer ${otherToken}`);
  assert.equal(otherList.status, 200);
  assert.equal(otherList.body.length, 0);

  const otherDelete = await request(app)
    .delete(`/api/watchlist/${instrumentId}`)
    .set("Authorization", `Bearer ${otherToken}`);
  assert.equal(otherDelete.status, 404);

  const del = await request(app)
    .delete(`/api/watchlist/${instrumentId}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(del.status, 204);

  const empty = await request(app)
    .get("/api/watchlist")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(empty.body.length, 0);
  } finally {
    if (prevKey !== undefined) process.env.TWELVE_DATA_API_KEY = prevKey;
    else delete process.env.TWELVE_DATA_API_KEY;
  }
});

test("POST /api/watchlist returns 404 for unknown instrument", async () => {
  const token = await registerAndLogin(
    "wlmiss@test.local",
    "wlmiss",
    "password123",
  );
  const res = await request(app)
    .post("/api/watchlist")
    .set("Authorization", `Bearer ${token}`)
    .send({ instrumentId: 999999 });
  assert.equal(res.status, 404);
});

test("POST /api/watchlist soft-fails GPW quote without OANOR_API_KEY", async () => {
  const prevOanor = process.env.OANOR_API_KEY;
  delete process.env.OANOR_API_KEY;
  try {
    const token = await registerAndLogin(
      "wlgpw@test.local",
      "wlgpw",
      "password123",
    );
    const row = await prisma.instrument.create({
      data: {
        symbol: "ETFBW20TR",
        name: "Beta ETF WIG20TR",
        exchange: "GPW",
        country: "Poland",
        currency: "PLN",
        assetClass: "ETF",
        provider: INSTRUMENT_PROVIDER_TWELVE_DATA,
        providerSymbol: "ETFBW20TR",
      },
    });
    const created = await request(app)
      .post("/api/watchlist")
      .set("Authorization", `Bearer ${token}`)
      .send({ instrumentId: row.id });
    assert.equal(created.status, 201);
    assert.equal(created.body.lastClose, null);
    assert.equal(created.body.instrument.symbol, "ETFBW20TR");
  } finally {
    if (prevOanor !== undefined) process.env.OANOR_API_KEY = prevOanor;
    else delete process.env.OANOR_API_KEY;
  }
});
