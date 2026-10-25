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

test("POST /api/transfers same currency updates both balances", async () => {
  const token = await registerAndLogin("xfer@test.local", "xferuser", "password123");
  const from = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "From PLN", currency: "PLN", openingBalance: 1000 });
  const to = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "To PLN", currency: "PLN", openingBalance: 100 });
  const fromId = from.body.id as number;
  const toId = to.body.id as number;

  const created = await request(app)
    .post("/api/transfers")
    .set("Authorization", `Bearer ${token}`)
    .send({
      fromAccountId: fromId,
      toAccountId: toId,
      amountFrom: 250,
      occurredAt: "2026-08-15T12:00:00.000Z",
      description: "move",
    });
  assert.equal(created.status, 201);
  assert.equal(created.body.amountFrom, 250);
  assert.equal(created.body.amountTo, 250);
  assert.equal(created.body.fromCurrency, "PLN");
  assert.equal(created.body.toCurrency, "PLN");
  assert.equal(created.body.fxRate, 1);
  assert.equal(created.body.description, "move");

  const fromAfter = await request(app)
    .get(`/api/accounts/${fromId}`)
    .set("Authorization", `Bearer ${token}`);
  const toAfter = await request(app)
    .get(`/api/accounts/${toId}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(fromAfter.body.cashBalance, 750);
  assert.equal(toAfter.body.cashBalance, 350);

  const fromTx = await request(app)
    .get(`/api/accounts/${fromId}/transactions`)
    .set("Authorization", `Bearer ${token}`);
  const toTx = await request(app)
    .get(`/api/accounts/${toId}/transactions`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(fromTx.body.items.length, 1);
  assert.equal(fromTx.body.items[0].type, "TRANSFER_OUT");
  assert.equal(fromTx.body.items[0].transferId, created.body.id);
  assert.equal(toTx.body.items[0].type, "TRANSFER_IN");
  assert.equal(toTx.body.items[0].transferId, created.body.id);
});

test("POST/PATCH /api/transfers optional TRANSFER category on both legs", async () => {
  const token = await registerAndLogin(
    "xfercat@test.local",
    "xfercat",
    "password123",
  );
  const cats = await request(app)
    .get("/api/categories")
    .set("Authorization", `Bearer ${token}`);
  const transferCat = (
    cats.body as Array<{ id: number; name: string; ledgerType: string }>
  ).find((c) => c.name === "Internal transfer");
  const food = (
    cats.body as Array<{ id: number; name: string; ledgerType: string }>
  ).find((c) => c.name === "Food");
  assert.ok(transferCat);
  assert.equal(transferCat!.ledgerType, "TRANSFER");
  assert.ok(food);

  const from = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "From Cat", currency: "PLN", openingBalance: 500 });
  const to = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "To Cat", currency: "PLN", openingBalance: 0 });

  const wrongType = await request(app)
    .post("/api/transfers")
    .set("Authorization", `Bearer ${token}`)
    .send({
      fromAccountId: from.body.id,
      toAccountId: to.body.id,
      amountFrom: 50,
      categoryId: food!.id,
    });
  assert.equal(wrongType.status, 400);

  const created = await request(app)
    .post("/api/transfers")
    .set("Authorization", `Bearer ${token}`)
    .send({
      fromAccountId: from.body.id,
      toAccountId: to.body.id,
      amountFrom: 50,
      categoryId: transferCat!.id,
    });
  assert.equal(created.status, 201);
  assert.equal(created.body.categoryId, transferCat!.id);

  const fromTx = await request(app)
    .get(`/api/accounts/${from.body.id}/transactions`)
    .set("Authorization", `Bearer ${token}`);
  const toTx = await request(app)
    .get(`/api/accounts/${to.body.id}/transactions`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(fromTx.body.items[0].categoryId, transferCat!.id);
  assert.equal(toTx.body.items[0].categoryId, transferCat!.id);

  const cleared = await request(app)
    .patch(`/api/transfers/${created.body.id}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ categoryId: null });
  assert.equal(cleared.status, 200);
  assert.equal(cleared.body.categoryId, null);

  const fromTx2 = await request(app)
    .get(`/api/accounts/${from.body.id}/transactions`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(fromTx2.body.items[0].categoryId, null);
});

test("POST /api/transfers cross currency requires amountTo and returns fxRate", async () => {
  const token = await registerAndLogin("xferfx@test.local", "xferfx", "password123");
  const from = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "PLN", currency: "PLN", openingBalance: 1000 });
  const to = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "EUR", currency: "EUR", openingBalance: 0 });

  const missing = await request(app)
    .post("/api/transfers")
    .set("Authorization", `Bearer ${token}`)
    .send({
      fromAccountId: from.body.id,
      toAccountId: to.body.id,
      amountFrom: 400,
    });
  assert.equal(missing.status, 400);

  const created = await request(app)
    .post("/api/transfers")
    .set("Authorization", `Bearer ${token}`)
    .send({
      fromAccountId: from.body.id,
      toAccountId: to.body.id,
      amountFrom: 400,
      amountTo: 100,
      occurredAt: "2026-08-01T00:00:00.000Z",
    });
  assert.equal(created.status, 201);
  assert.equal(created.body.amountFrom, 400);
  assert.equal(created.body.amountTo, 100);
  assert.equal(created.body.fxRate, 0.25);
});

test("POST /api/transfers rejects same account and foreign account", async () => {
  const token = await registerAndLogin("xferbad@test.local", "xferbad", "password123");
  const other = await registerAndLogin("xferoth@test.local", "xferoth", "password123");
  const mine = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Mine", currency: "PLN", openingBalance: 100 });
  const theirs = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${other}`)
    .send({ name: "Theirs", currency: "PLN", openingBalance: 100 });

  const same = await request(app)
    .post("/api/transfers")
    .set("Authorization", `Bearer ${token}`)
    .send({
      fromAccountId: mine.body.id,
      toAccountId: mine.body.id,
      amountFrom: 10,
    });
  assert.equal(same.status, 400);

  const foreign = await request(app)
    .post("/api/transfers")
    .set("Authorization", `Bearer ${token}`)
    .send({
      fromAccountId: mine.body.id,
      toAccountId: theirs.body.id,
      amountFrom: 10,
    });
  assert.equal(foreign.status, 404);
});

test("PATCH/DELETE /api/transfers adjust balances; leg endpoints reject edits", async () => {
  const token = await registerAndLogin("xferupd@test.local", "xferupd", "password123");
  const a = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "A", currency: "PLN", openingBalance: 1000 });
  const b = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "B", currency: "PLN", openingBalance: 0 });
  const c = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "C", currency: "PLN", openingBalance: 50 });
  const aId = a.body.id as number;
  const bId = b.body.id as number;
  const cId = c.body.id as number;

  const created = await request(app)
    .post("/api/transfers")
    .set("Authorization", `Bearer ${token}`)
    .send({ fromAccountId: aId, toAccountId: bId, amountFrom: 200 });
  assert.equal(created.status, 201);
  const transferId = created.body.id as number;

  const legsA = await request(app)
    .get(`/api/accounts/${aId}/transactions`)
    .set("Authorization", `Bearer ${token}`);
  const legId = legsA.body.items[0].id as number;

  const patchLeg = await request(app)
    .patch(`/api/accounts/${aId}/transactions/${legId}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ amount: 1 });
  assert.equal(patchLeg.status, 400);
  assert.match(String(patchLeg.body.error), /\/api\/transfers/);

  const deleteLeg = await request(app)
    .delete(`/api/accounts/${aId}/transactions/${legId}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(deleteLeg.status, 400);

  const patched = await request(app)
    .patch(`/api/transfers/${transferId}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ amountFrom: 300, toAccountId: cId });
  assert.equal(patched.status, 200);
  assert.equal(patched.body.amountFrom, 300);
  assert.equal(patched.body.toAccountId, cId);

  const aAfter = await request(app)
    .get(`/api/accounts/${aId}`)
    .set("Authorization", `Bearer ${token}`);
  const bAfter = await request(app)
    .get(`/api/accounts/${bId}`)
    .set("Authorization", `Bearer ${token}`);
  const cAfter = await request(app)
    .get(`/api/accounts/${cId}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(aAfter.body.cashBalance, 700);
  assert.equal(bAfter.body.cashBalance, 0);
  assert.equal(cAfter.body.cashBalance, 350);

  const deleted = await request(app)
    .delete(`/api/transfers/${transferId}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(deleted.status, 204);

  const aFinal = await request(app)
    .get(`/api/accounts/${aId}`)
    .set("Authorization", `Bearer ${token}`);
  const cFinal = await request(app)
    .get(`/api/accounts/${cId}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(aFinal.body.cashBalance, 1000);
  assert.equal(cFinal.body.cashBalance, 50);
});

test("transfers are excluded from cashflow stats and included in balance-history", async () => {
  const token = await registerAndLogin("xferstat@test.local", "xferstat", "password123");
  const from = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Stat From", currency: "PLN", openingBalance: 500 });
  const to = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Stat To", currency: "PLN", openingBalance: 0 });
  const fromId = from.body.id as number;
  const toId = to.body.id as number;

  await request(app)
    .post(`/api/accounts/${fromId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ type: "INCOME", amount: 100, occurredAt: "2026-08-05T00:00:00.000Z" });
  await request(app)
    .post("/api/transfers")
    .set("Authorization", `Bearer ${token}`)
    .send({
      fromAccountId: fromId,
      toAccountId: toId,
      amountFrom: 200,
      occurredAt: "2026-08-10T00:00:00.000Z",
    });

  const summary = await request(app)
    .get("/api/statistics/period-summary?month=2026-08&currency=PLN")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(summary.status, 200);
  assert.equal(summary.body.income, 100);
  assert.equal(summary.body.expense, 0);
  assert.equal(summary.body.net, 100);
  assert.equal(summary.body.transfers, 200);

  const breakdown = await request(app)
    .get("/api/statistics/category-breakdown?month=2026-08")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(breakdown.status, 200);
  assert.equal(breakdown.body.income.length, 1);
  assert.equal(breakdown.body.income[0].total, 100);
  assert.equal(breakdown.body.expense.length, 0);
  assert.equal(breakdown.body.transfer.length, 1);
  assert.equal(breakdown.body.transfer[0].total, 200);
  assert.equal(breakdown.body.transfer[0].categoryName, "Uncategorized");

  const history = await request(app)
    .get(`/api/accounts/${fromId}/balance-history?month=2026-08&months=6`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(history.status, 200);
  const aug = history.body.series.find((p: { month: string }) => p.month === "2026-08");
  // opening 500 + income 100 - transfer out 200
  assert.equal(aug.balance, 400);
});

test("DELETE /api/accounts/:id returns 409 when account has transfers", async () => {
  const token = await registerAndLogin("xferdel@test.local", "xferdel", "password123");
  const from = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Del From", currency: "PLN", openingBalance: 100 });
  const to = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Del To", currency: "PLN", openingBalance: 0 });

  await request(app)
    .post("/api/transfers")
    .set("Authorization", `Bearer ${token}`)
    .send({
      fromAccountId: from.body.id,
      toAccountId: to.body.id,
      amountFrom: 25,
    });

  const del = await request(app)
    .delete(`/api/accounts/${from.body.id}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(del.status, 409);
  assert.match(String(del.body.error), /delete transfers first/i);
});

test("GET/POST /api/transfers export import preview with account mapping", async () => {
  const tokenA = await registerAndLogin(
    "xfercsv-a@test.local",
    "xfercsva",
    "password123",
  );
  const tokenB = await registerAndLogin(
    "xfercsv-b@test.local",
    "xfercsvb",
    "password123",
  );

  const unauth = await request(app).get("/api/transfers/export");
  assert.equal(unauth.status, 401);

  const aFrom = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${tokenA}`)
    .send({ name: "Alpha Checking", currency: "PLN", openingBalance: 1000 });
  const aTo = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${tokenA}`)
    .send({ name: "Alpha Brokerage", currency: "PLN", openingBalance: 100 });
  const aEuro = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${tokenA}`)
    .send({ name: "Alpha Euro", currency: "EUR", openingBalance: 50 });

  await request(app)
    .post("/api/transfers")
    .set("Authorization", `Bearer ${tokenA}`)
    .send({
      fromAccountId: aFrom.body.id,
      toAccountId: aTo.body.id,
      amountFrom: 200,
      occurredAt: "2024-05-01T12:00:00.000Z",
      description: "invest",
    });
  await request(app)
    .post("/api/transfers")
    .set("Authorization", `Bearer ${tokenA}`)
    .send({
      fromAccountId: aFrom.body.id,
      toAccountId: aEuro.body.id,
      amountFrom: 400,
      amountTo: 90,
      occurredAt: "2024-05-02T12:00:00.000Z",
      description: "travel",
    });

  const exported = await request(app)
    .get("/api/transfers/export")
    .set("Authorization", `Bearer ${tokenA}`);
  assert.equal(exported.status, 200);
  assert.match(String(exported.headers["content-type"]), /text\/csv/);
  const lines = exported.text.trimEnd().split("\n");
  assert.equal(
    lines[0],
    "id,occurredAt,fromAccount,fromCurrency,toAccount,toCurrency,amountFrom,amountTo,description,categoryPath,createdAt",
  );
  assert.equal(lines.length, 3);
  assert.match(lines[1]!, /Alpha Checking,PLN,Alpha Brokerage,PLN,200\.00,200\.00/);
  assert.match(lines[2]!, /Alpha Checking,PLN,Alpha Euro,EUR,400\.00,90\.00/);

  const otherExport = await request(app)
    .get("/api/transfers/export")
    .set("Authorization", `Bearer ${tokenB}`);
  assert.equal(otherExport.status, 200);
  assert.equal(
    otherExport.text,
    "id,occurredAt,fromAccount,fromCurrency,toAccount,toCurrency,amountFrom,amountTo,description,categoryPath,createdAt\n",
  );

  const previewBare = await request(app)
    .post("/api/transfers/import/preview")
    .set("Authorization", `Bearer ${tokenB}`)
    .send({ csv: exported.text });
  assert.equal(previewBare.status, 200);
  assert.equal(previewBare.body.rowCount, 2);
  assert.equal(previewBare.body.accounts.length, 3);
  assert.deepEqual(previewBare.body.rows, []);
  assert.ok(
    (previewBare.body.accounts as Array<{ suggestedAccountId: number | null }>).every(
      (a) => a.suggestedAccountId == null,
    ),
  );

  const bFrom = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${tokenB}`)
    .send({ name: "Beta Cash", currency: "PLN", openingBalance: 1000 });
  const bTo = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${tokenB}`)
    .send({ name: "Beta Invest", currency: "PLN", openingBalance: 100 });
  const bEuro = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${tokenB}`)
    .send({ name: "Beta Euro", currency: "EUR", openingBalance: 50 });

  const mappings = [
    { name: "Alpha Checking", currency: "PLN", accountId: bFrom.body.id },
    { name: "Alpha Brokerage", currency: "PLN", accountId: bTo.body.id },
    { name: "Alpha Euro", currency: "EUR", accountId: bEuro.body.id },
  ];

  const missingMap = await request(app)
    .post("/api/transfers/import")
    .set("Authorization", `Bearer ${tokenB}`)
    .send({ csv: exported.text, accountMappings: [] });
  assert.equal(missingMap.status, 400);
  assert.match(String(missingMap.body.error), /missing mapping/i);

  const badCurrency = await request(app)
    .post("/api/transfers/import")
    .set("Authorization", `Bearer ${tokenB}`)
    .send({
      csv: exported.text,
      accountMappings: [
        { name: "Alpha Checking", currency: "PLN", accountId: bEuro.body.id },
        { name: "Alpha Brokerage", currency: "PLN", accountId: bTo.body.id },
        { name: "Alpha Euro", currency: "EUR", accountId: bEuro.body.id },
      ],
    });
  assert.equal(badCurrency.status, 400);
  assert.match(String(badCurrency.body.error), /currency/i);

  const foreignMap = await request(app)
    .post("/api/transfers/import")
    .set("Authorization", `Bearer ${tokenB}`)
    .send({
      csv: exported.text,
      accountMappings: [
        { name: "Alpha Checking", currency: "PLN", accountId: aFrom.body.id },
        { name: "Alpha Brokerage", currency: "PLN", accountId: bTo.body.id },
        { name: "Alpha Euro", currency: "EUR", accountId: bEuro.body.id },
      ],
    });
  assert.equal(foreignMap.status, 400);
  assert.match(String(foreignMap.body.error), /not found/i);

  const previewMapped = await request(app)
    .post("/api/transfers/import/preview")
    .set("Authorization", `Bearer ${tokenB}`)
    .send({ csv: exported.text, accountMappings: mappings });
  assert.equal(previewMapped.status, 200);
  assert.equal(previewMapped.body.rows.length, 2);
  assert.ok(
    (previewMapped.body.rows as Array<{ duplicate: boolean }>).every(
      (r) => r.duplicate === false,
    ),
  );

  const imported = await request(app)
    .post("/api/transfers/import")
    .set("Authorization", `Bearer ${tokenB}`)
    .send({ csv: exported.text, accountMappings: mappings });
  assert.equal(imported.status, 201);
  assert.equal(imported.body.created, 2);
  assert.equal(imported.body.skipped, 0);

  const bFromAfter = await request(app)
    .get(`/api/accounts/${bFrom.body.id}`)
    .set("Authorization", `Bearer ${tokenB}`);
  const bToAfter = await request(app)
    .get(`/api/accounts/${bTo.body.id}`)
    .set("Authorization", `Bearer ${tokenB}`);
  const bEuroAfter = await request(app)
    .get(`/api/accounts/${bEuro.body.id}`)
    .set("Authorization", `Bearer ${tokenB}`);
  assert.equal(bFromAfter.body.cashBalance, 400);
  assert.equal(bToAfter.body.cashBalance, 300);
  assert.equal(bEuroAfter.body.cashBalance, 140);

  const legs = await request(app)
    .get(`/api/accounts/${bFrom.body.id}/transactions`)
    .set("Authorization", `Bearer ${tokenB}`);
  assert.ok(
    (legs.body.items as Array<{ type: string }>).some(
      (t) => t.type === "TRANSFER_OUT",
    ),
  );

  const rePreview = await request(app)
    .post("/api/transfers/import/preview")
    .set("Authorization", `Bearer ${tokenB}`)
    .send({ csv: exported.text, accountMappings: mappings });
  assert.equal(rePreview.status, 200);
  assert.ok(
    (rePreview.body.rows as Array<{ duplicate: boolean }>).every(
      (r) => r.duplicate === true,
    ),
  );

  const skipAll = (rePreview.body.rows as Array<{ row: number }>).map((r) => r.row);
  const skippedImport = await request(app)
    .post("/api/transfers/import")
    .set("Authorization", `Bearer ${tokenB}`)
    .send({
      csv: exported.text,
      accountMappings: mappings,
      skipRows: skipAll,
    });
  assert.equal(skippedImport.status, 201);
  assert.equal(skippedImport.body.created, 0);
  assert.equal(skippedImport.body.skipped, 2);

  const balAfterSkip = await request(app)
    .get(`/api/accounts/${bFrom.body.id}`)
    .set("Authorization", `Bearer ${tokenB}`);
  assert.equal(balAfterSkip.body.cashBalance, 400);

  // Re-import without skipRows must server-side skip ledger duplicates (not trust client).
  const recreated = await request(app)
    .post("/api/transfers/import")
    .set("Authorization", `Bearer ${tokenB}`)
    .send({ csv: exported.text, accountMappings: mappings });
  assert.equal(recreated.status, 201);
  assert.equal(recreated.body.created, 0);
  assert.equal(recreated.body.skipped, 2);
  const balAfterRecreate = await request(app)
    .get(`/api/accounts/${bFrom.body.id}`)
    .set("Authorization", `Bearer ${tokenB}`);
  assert.equal(balAfterRecreate.body.cashBalance, 400);

  const header =
    "id,occurredAt,fromAccount,fromCurrency,toAccount,toCurrency,amountFrom,amountTo,description,createdAt";
  const atomicCsv = [
    header,
    ",2024-06-01T12:00:00.000Z,Alpha Checking,PLN,Alpha Brokerage,PLN,10.00,10.00,ok,",
    ",2024-06-02T12:00:00.000Z,Alpha Checking,PLN,Alpha Brokerage,PLN,10.00,9.00,bad,",
  ].join("\n");
  const beforeAtomic = await request(app)
    .get(`/api/accounts/${bFrom.body.id}`)
    .set("Authorization", `Bearer ${tokenB}`);
  const atomic = await request(app)
    .post("/api/transfers/import")
    .set("Authorization", `Bearer ${tokenB}`)
    .send({
      csv: atomicCsv,
      accountMappings: [
        { name: "Alpha Checking", currency: "PLN", accountId: bFrom.body.id },
        { name: "Alpha Brokerage", currency: "PLN", accountId: bTo.body.id },
      ],
    });
  assert.equal(atomic.status, 400);
  const afterAtomic = await request(app)
    .get(`/api/accounts/${bFrom.body.id}`)
    .set("Authorization", `Bearer ${tokenB}`);
  assert.equal(afterAtomic.body.cashBalance, beforeAtomic.body.cashBalance);
});
