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
  allowlisted?: boolean;
  exchange?: string;
  country?: string;
}): Promise<number> {
  const symbol = input?.symbol ?? "AAPL";
  const row = await prisma.instrument.create({
    data: {
      symbol,
      name: input?.name ?? "Apple Inc",
      exchange: input?.exchange ?? "NASDAQ",
      country: input?.country ?? null,
      currency: "USD",
      assetClass: input?.assetClass ?? "STOCK",
      provider: INSTRUMENT_PROVIDER_TWELVE_DATA,
      providerSymbol: symbol,
      allowlisted: input?.allowlisted ?? true,
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

test("GET /api/instruments searches allowlist by default; catalog sees all", async () => {
  const token = await registerAndLogin(
    "instsearch@test.local",
    "instsearch",
    "password123",
  );
  await seedInstrument({ symbol: "AAPL", name: "Apple Inc", allowlisted: true });
  await seedInstrument({
    symbol: "MSFT",
    name: "Microsoft",
    allowlisted: false,
  });
  await seedInstrument({
    symbol: "VOO",
    name: "Vanguard S&P 500",
    assetClass: "ETF",
    allowlisted: true,
  });

  const res = await request(app)
    .get("/api/instruments?q=aap")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 1);
  assert.equal(res.body[0].symbol, "AAPL");

  const hidden = await request(app)
    .get("/api/instruments?q=msf")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(hidden.status, 200);
  assert.equal(hidden.body.length, 0);

  const catalog = await request(app)
    .get("/api/instruments?q=msf&scope=catalog")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(catalog.status, 200);
  assert.equal(catalog.body.length, 1);
  assert.equal(catalog.body[0].symbol, "MSFT");

  const etfs = await request(app)
    .get("/api/instruments?q=voo&assetClass=ETF")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(etfs.status, 200);
  assert.equal(etfs.body.length, 1);
  assert.equal(etfs.body[0].assetClass, "ETF");
});

test("POST /api/instruments/allowlist adds to global search", async () => {
  const prevKey = process.env.TWELVE_DATA_API_KEY;
  delete process.env.TWELVE_DATA_API_KEY;
  try {
    const token = await registerAndLogin(
      "allow@test.local",
      "allowuser",
      "password123",
    );
    const id = await seedInstrument({
      symbol: "TSLA",
      name: "Tesla",
      allowlisted: false,
    });
    const before = await request(app)
      .get("/api/instruments?q=tsl")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(before.body.length, 0);

    const added = await request(app)
      .post("/api/instruments/allowlist")
      .set("Authorization", `Bearer ${token}`)
      .send({ instrumentId: id });
    assert.equal(added.status, 200);
    assert.equal(added.body.allowlisted, true);

    const after = await request(app)
      .get("/api/instruments?q=tsl")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(after.body.length, 1);
  } finally {
    if (prevKey !== undefined) process.env.TWELVE_DATA_API_KEY = prevKey;
    else delete process.env.TWELVE_DATA_API_KEY;
  }
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

test("GET /api/instruments/:id/history requires auth and 404s unknown", async () => {
  const noAuth = await request(app).get("/api/instruments/1/history");
  assert.equal(noAuth.status, 401);

  const token = await registerAndLogin(
    "histauth@test.local",
    "histauth",
    "password123",
  );
  const missing = await request(app)
    .get("/api/instruments/999999/history")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(missing.status, 404);
});

test("GET /api/instruments/:id/history returns series and soft-fails backfill", async () => {
  const prevKey = process.env.TWELVE_DATA_API_KEY;
  delete process.env.TWELVE_DATA_API_KEY;
  try {
    const token = await registerAndLogin(
      "hist@test.local",
      "histuser",
      "password123",
    );
    const id = await seedInstrument({ symbol: "MSFT", name: "Microsoft" });
    await prisma.instrumentValuation.create({
      data: {
        instrumentId: id,
        asOfDate: new Date(Date.UTC(2026, 9, 15)),
        close: 420.5,
        source: "twelve_data",
      },
    });
    await prisma.instrumentValuation.create({
      data: {
        instrumentId: id,
        asOfDate: new Date(Date.UTC(2026, 9, 16)),
        close: 421.25,
        source: "twelve_data",
      },
    });

    const res = await request(app)
      .get(`/api/instruments/${id}/history?months=3`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.months, 3);
    assert.equal(res.body.year, null);
    assert.equal(res.body.oldestYear, 2026);
    assert.equal(res.body.newestYear, 2026);
    assert.equal(res.body.instrument.symbol, "MSFT");
    assert.equal(res.body.currency, "USD");
    assert.ok(Array.isArray(res.body.series));
    assert.ok(res.body.series.length >= 2);
    assert.equal(typeof res.body.backfilled, "boolean");
    // Without API key, soft backfill should not 500.
    assert.equal(res.status, 200);

    const byYear = await request(app)
      .get(`/api/instruments/${id}/history?year=2026`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(byYear.status, 200);
    assert.equal(byYear.body.year, 2026);
    assert.equal(byYear.body.months, null);
    assert.equal(byYear.body.from, "2026-01-01");
    assert.ok(byYear.body.series.length >= 2);
  } finally {
    if (prevKey !== undefined) process.env.TWELVE_DATA_API_KEY = prevKey;
    else delete process.env.TWELVE_DATA_API_KEY;
  }
});

test("POST /api/watchlist soft-fails quote when marketLiveApi is off", async () => {
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
});
