import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import {
  createUserAndToken as createUserAndTokenHarness,
  noneDescriptionMappings,
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

test("POST /api/accounts/:id/transactions/import preview and mapped import", async () => {
  const token = await registerAndLogin(
    "csvimport@test.local",
    "csvimport",
    "password123",
  );
  const otherToken = await registerAndLogin(
    "csvimportother@test.local",
    "csvimportother",
    "password123",
  );

  const unauth = await request(app).post(
    "/api/accounts/1/transactions/import/preview",
  );
  assert.equal(unauth.status, 401);

  const account = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "Import Bank",
      accountType: "BANK",
      currency: "PLN",
      openingBalance: 100,
    });
  assert.equal(account.status, 201);
  const accountId = account.body.id as number;

  const cats = await request(app)
    .get("/api/categories")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(cats.status, 200);
  const food = (cats.body as Array<{ id: number; name: string }>).find(
    (c) => c.name === "Food",
  );
  assert.ok(food);

  const header =
    "id,type,amount,currency,occurredAt,description,categoryPath,createdAt";
  const csv = [
    header,
    `,INCOME,50.00,PLN,2024-03-01T12:00:00.000Z,Pay,,`,
    `,EXPENSE,20.00,PLN,2024-03-02T12:00:00.000Z,Lunch,Food,`,
    `,EXPENSE,5.00,PLN,2024-03-03T12:00:00.000Z,Shop,Food/Groceries,`,
  ].join("\n");

  const preview = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import/preview`)
    .set("Authorization", `Bearer ${token}`)
    .send({ csv });
  assert.equal(preview.status, 200);
  assert.equal(preview.body.rowCount, 3);
  assert.equal(preview.body.categories.length, 2);
  const foodPreview = (
    preview.body.categories as Array<{
      path: string;
      suggestedCategoryId: number | null;
    }>
  ).find((c) => c.path === "Food");
  assert.ok(foodPreview);
  assert.equal(foodPreview!.suggestedCategoryId, food!.id);
  const groceriesPreview = (
    preview.body.categories as Array<{
      path: string;
      suggestedCategoryId: number | null;
    }>
  ).find((c) => c.path === "Food/Groceries");
  assert.ok(groceriesPreview);
  assert.equal(groceriesPreview!.suggestedCategoryId, null);
  assert.equal(preview.body.descriptionSuggestions.length, 1);
  assert.equal(preview.body.descriptionSuggestions[0].descriptionKey, "pay");

  const payDescNone = noneDescriptionMappings(
    preview.body.descriptionSuggestions,
  );

  const missingMap = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import`)
    .set("Authorization", `Bearer ${token}`)
    .send({ csv, categoryMappings: [], descriptionMappings: payDescNone });
  assert.equal(missingMap.status, 400);
  assert.match(String(missingMap.body.error), /missing mapping/i);

  const foreignMap = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      csv,
      categoryMappings: [
        { path: "Food", ledgerType: "EXPENSE", action: "map", categoryId: 999999 },
        { path: "Food/Groceries", ledgerType: "EXPENSE", action: "create" },
      ],
      descriptionMappings: payDescNone,
    });
  assert.equal(foreignMap.status, 400);
  assert.match(String(foreignMap.body.error), /not found/i);

  const imported = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      csv,
      categoryMappings: [
        {
          path: "Food",
          ledgerType: "EXPENSE",
          action: "map",
          categoryId: food!.id,
        },
        { path: "Food/Groceries", ledgerType: "EXPENSE", action: "create" },
      ],
      descriptionMappings: payDescNone,
    });
  assert.equal(imported.status, 201);
  assert.equal(imported.body.created, 3);
  assert.equal(imported.body.createdCategories, 1);

  const listed = await request(app)
    .get(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(listed.status, 200);
  assert.equal(listed.body.items.length, 3);
  const lunch = (
    listed.body.items as Array<{ description: string | null; categoryId: number | null }>
  ).find((t) => t.description === "Lunch");
  assert.equal(lunch!.categoryId, food!.id);

  const catsAfter = await request(app)
    .get("/api/categories")
    .set("Authorization", `Bearer ${token}`);
  const groceries = (
    catsAfter.body as Array<{ id: number; name: string; parentId: number | null }>
  ).find((c) => c.name === "Groceries" && c.parentId === food!.id);
  assert.ok(groceries);

  const detail = await request(app)
    .get(`/api/accounts/${accountId}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.cashBalance, 125);

  const roundTrip = await request(app)
    .get(`/api/accounts/${accountId}/transactions/export`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(roundTrip.status, 200);
  const reimportPreview = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import/preview`)
    .set("Authorization", `Bearer ${token}`)
    .send({ csv: roundTrip.text });
  assert.equal(reimportPreview.status, 200);
  assert.equal(reimportPreview.body.rowCount, 0);
  assert.ok(reimportPreview.body.duplicateCount >= 3);
  assert.equal(reimportPreview.body.categories.length, 0);
  const reimported = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      csv: roundTrip.text,
      categoryMappings: [],
    });
  assert.equal(reimported.status, 201);
  assert.equal(reimported.body.created, 0);
  assert.ok(reimported.body.duplicateCount >= 3);

  const noCatCsv = `${header}\n,INCOME,10.00,PLN,2024-04-01T12:00:00.000Z,Bonus,,\n`;
  const emptyCats = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      csv: noCatCsv,
      categoryMappings: [],
      descriptionMappings: [
        { descriptionKey: "bonus", ledgerType: "INCOME", action: "none" },
      ],
    });
  assert.equal(emptyCats.status, 201);
  assert.equal(emptyCats.body.created, 1);
  assert.equal(emptyCats.body.createdCategories, 0);

  const empty = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import`)
    .set("Authorization", `Bearer ${token}`)
    .send({ csv: `${header}\n`, categoryMappings: [] });
  assert.equal(empty.status, 201);
  assert.equal(empty.body.created, 0);

  const badCurrency = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import/preview`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      csv: `${header}\n,INCOME,1.00,USD,2024-01-01T00:00:00.000Z,,,\n`,
    });
  assert.equal(badCurrency.status, 400);
  assert.ok(Array.isArray(badCurrency.body.details));

  const forbidden = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import`)
    .set("Authorization", `Bearer ${otherToken}`)
    .send({ csv: `${header}\n`, categoryMappings: [] });
  assert.equal(forbidden.status, 404);

  const missingCsv = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import`)
    .set("Authorization", `Bearer ${token}`)
    .send({});
  assert.equal(missingCsv.status, 400);

  const emptyCurrency = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      csv: `${header}\n,EXPENSE,1.00,,2024-01-01T00:00:00.000Z,,,\n`,
      categoryMappings: [],
    });
  assert.equal(emptyCurrency.status, 400);
  assert.match(emptyCurrency.body.details[0].message, /currency/);

  const badAmount = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      csv: `${header}\n,EXPENSE,0,PLN,2024-01-01T00:00:00.000Z,,,\n`,
      categoryMappings: [],
    });
  assert.equal(badAmount.status, 400);
  assert.match(badAmount.body.details[0].message, /amount|positive/i);

  const withTransfersCsv = [
    header,
    `,INCOME,10.00,PLN,2024-05-01T12:00:00.000Z,Bonus,,`,
    `,TRANSFER_OUT,3.00,PLN,2024-05-02T12:00:00.000Z,Move,,`,
    `,TRANSFER_IN,3.00,PLN,2024-05-02T12:00:00.000Z,Move,,`,
  ].join("\n");
  const transferPreview = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import/preview`)
    .set("Authorization", `Bearer ${token}`)
    .send({ csv: withTransfersCsv });
  assert.equal(transferPreview.status, 200);
  assert.equal(transferPreview.body.rowCount, 1);
  assert.equal(transferPreview.body.skipped, 2);
  assert.equal(transferPreview.body.skippedTransfers.length, 2);
  assert.equal(transferPreview.body.skippedTransfers[0].type, "TRANSFER_OUT");

  const transferImport = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      csv: withTransfersCsv,
      categoryMappings: [],
      descriptionMappings: noneDescriptionMappings(
        transferPreview.body.descriptionSuggestions,
      ),
    });
  assert.equal(transferImport.status, 201);
  assert.equal(transferImport.body.created, 1);
  assert.equal(transferImport.body.skipped, 2);
  assert.equal(transferImport.body.skippedTransfers.length, 2);

  const legacyHeader =
    "id,type,amount,currency,occurredAt,description,categoryId,categoryName,createdAt";
  const legacyCsv = [
    legacyHeader,
    `,INCOME,15.00,PLN,2024-06-01T12:00:00.000Z,Legacy pay,,,`,
    `,EXPENSE,7.00,PLN,2024-06-02T12:00:00.000Z,Legacy lunch,${food!.id},Food,`,
    `,EXPENSE,3.00,PLN,2024-06-03T12:00:00.000Z,Unknown cat,,Mystery,`,
  ].join("\n");
  const legacyPreview = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import/preview`)
    .set("Authorization", `Bearer ${token}`)
    .send({ csv: legacyCsv });
  assert.equal(legacyPreview.status, 200);
  assert.equal(legacyPreview.body.rowCount, 3);
  const legacyFood = (
    legacyPreview.body.categories as Array<{
      path: string;
      suggestedCategoryId: number | null;
    }>
  ).find((c) => c.path === "Food");
  assert.ok(legacyFood);
  assert.equal(legacyFood!.suggestedCategoryId, food!.id);
  const mystery = (
    legacyPreview.body.categories as Array<{
      path: string;
      suggestedCategoryId: number | null;
    }>
  ).find((c) => c.path === "Mystery");
  assert.ok(mystery);
  assert.equal(mystery!.suggestedCategoryId, null);

  const legacyImported = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      csv: legacyCsv,
      categoryMappings: [
        {
          path: "Food",
          ledgerType: "EXPENSE",
          action: "map",
          categoryId: food!.id,
        },
        { path: "Mystery", ledgerType: "EXPENSE", action: "none" },
      ],
      descriptionMappings: noneDescriptionMappings(
        legacyPreview.body.descriptionSuggestions,
      ),
    });
  assert.equal(legacyImported.status, 201);
  assert.equal(legacyImported.body.created, 3);
});

test("POST /api/accounts/:id/transactions/import/columns preview apply commit", async () => {
  const token = await registerAndLogin(
    "csvcols@test.local",
    "csvcols",
    "password123",
  );
  const account = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "Column Map Bank",
      accountType: "BANK",
      currency: "PLN",
      openingBalance: 200,
    });
  assert.equal(account.status, 201);
  const accountId = account.body.id as number;

  const csv = [
    "Data;Kwota;Opis",
    "15.01.2026;-12,50;Sklep",
    "16.01.2026;100,00;Wplata",
  ].join("\n");

  const unauth = await request(app).post(
    `/api/accounts/${accountId}/transactions/import/columns/preview`,
  );
  assert.equal(unauth.status, 401);

  const cols = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import/columns/preview`)
    .set("Authorization", `Bearer ${token}`)
    .send({ csv });
  assert.equal(cols.status, 200);
  assert.equal(cols.body.delimiter, ";");
  assert.deepEqual(cols.body.headers, ["Data", "Kwota", "Opis"]);
  assert.equal(cols.body.sampleRows.length, 2);
  assert.equal(cols.body.suggestedMapping.occurredAt, 0);
  assert.equal(cols.body.suggestedMapping.amount, 1);
  assert.equal(cols.body.suggestedMapping.description, 2);
  assert.equal(cols.body.matchingPresetId, null);

  const badMap = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import/columns/apply`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      csv,
      columnMapping: { occurredAt: 0, amount: 1 },
    });
  assert.equal(badMap.status, 400);

  const columnMapping = {
    occurredAt: 0,
    amount: 1,
    description: 2,
    amountSignMode: "negativeIsExpense",
  };

  const apply = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import/columns/apply`)
    .set("Authorization", `Bearer ${token}`)
    .send({ csv, columnMapping });
  assert.equal(apply.status, 200);
  assert.equal(apply.body.rowCount, 2);
  assert.equal(apply.body.categories.length, 0);
  assert.equal(apply.body.descriptionSuggestions.length, 2);

  const committed = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import/columns/commit`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      csv,
      columnMapping,
      categoryMappings: [],
      descriptionMappings: noneDescriptionMappings(
        apply.body.descriptionSuggestions,
      ),
    });
  assert.equal(committed.status, 201);
  assert.equal(committed.body.created, 2);

  const listed = await request(app)
    .get(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(listed.status, 200);
  const items = listed.body.items as Array<{
    type: string;
    amount: number;
    description: string | null;
  }>;
  assert.equal(items.length, 2);
  const sklep = items.find((t) => t.description === "Sklep");
  const wplata = items.find((t) => t.description === "Wplata");
  assert.equal(sklep!.type, "EXPENSE");
  assert.equal(sklep!.amount, 12.5);
  assert.equal(wplata!.type, "INCOME");
  assert.equal(wplata!.amount, 100);

  const ccCsv = [
    "Date,Amount,Memo",
    "2026-02-01,45.00,Charge",
    "2026-02-02,-20.00,Payment",
  ].join("\n");
  const ccMap = {
    occurredAt: 0,
    amount: 1,
    description: 2,
    amountSignMode: "negativeIsIncome",
  };
  const ccApply = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import/columns/apply`)
    .set("Authorization", `Bearer ${token}`)
    .send({ csv: ccCsv, columnMapping: ccMap });
  assert.equal(ccApply.status, 200);
  const ccCommit = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import/columns/commit`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      csv: ccCsv,
      columnMapping: ccMap,
      categoryMappings: [],
      descriptionMappings: noneDescriptionMappings(
        ccApply.body.descriptionSuggestions,
      ),
    });
  assert.equal(ccCommit.status, 201);
  assert.equal(ccCommit.body.created, 2);

  const afterCc = await request(app)
    .get(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${token}`);
  const charge = (
    afterCc.body.items as Array<{ type: string; description: string | null }>
  ).find((t) => t.description === "Charge");
  const payment = (
    afterCc.body.items as Array<{ type: string; description: string | null }>
  ).find((t) => t.description === "Payment");
  assert.equal(charge!.type, "EXPENSE");
  assert.equal(payment!.type, "INCOME");
});

test("CSV import presets CRUD and columns preview matchingPresetId", async () => {
  const token = await registerAndLogin(
    "csvpresets@test.local",
    "csvpresets",
    "password123",
  );
  const account = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "Preset Bank",
      accountType: "BANK",
      currency: "PLN",
      openingBalance: 0,
    });
  assert.equal(account.status, 201);
  const accountId = account.body.id as number;
  const headers = ["Data", "Kwota", "Opis"];

  const unauth = await request(app).get(
    `/api/accounts/${accountId}/import-presets`,
  );
  assert.equal(unauth.status, 401);

  const created = await request(app)
    .post(`/api/accounts/${accountId}/import-presets`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "mBank ROR",
      headers,
      columnMapping: {
        occurredAt: 0,
        amount: 1,
        description: 2,
        amountSignMode: "negativeIsExpense",
      },
    });
  assert.equal(created.status, 201);
  assert.equal(created.body.name, "mBank ROR");
  assert.equal(created.body.mapping.occurredAt, "Data");
  assert.equal(created.body.mapping.amount, "Kwota");
  assert.equal(created.body.mapping.description, "Opis");
  assert.equal(created.body.mapping.amountSignMode, "negativeIsExpense");
  const presetId = created.body.id as number;

  const dup = await request(app)
    .post(`/api/accounts/${accountId}/import-presets`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "mbank ror",
      headers,
      columnMapping: {
        occurredAt: 0,
        amount: 1,
        amountSignMode: "negativeIsExpense",
      },
    });
  assert.equal(dup.status, 400);

  const listed = await request(app)
    .get(`/api/accounts/${accountId}/import-presets`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(listed.status, 200);
  assert.equal(listed.body.length, 1);

  const csv = ["Data;Kwota;Opis", "15.01.2026;-1,00;X"].join("\n");
  const preview = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import/columns/preview`)
    .set("Authorization", `Bearer ${token}`)
    .send({ csv });
  assert.equal(preview.status, 200);
  assert.equal(preview.body.matchingPresetId, presetId);

  const applyNamed = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import/columns/apply`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      csv,
      columnMapping: {
        occurredAt: "Data",
        amount: "Kwota",
        description: "Opis",
        amountSignMode: "negativeIsExpense",
      },
    });
  assert.equal(applyNamed.status, 200);
  assert.equal(applyNamed.body.rowCount, 1);

  const renamed = await request(app)
    .patch(`/api/accounts/${accountId}/import-presets/${presetId}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Bank export" });
  assert.equal(renamed.status, 200);
  assert.equal(renamed.body.name, "Bank export");

  const deleted = await request(app)
    .delete(`/api/accounts/${accountId}/import-presets/${presetId}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(deleted.status, 204);

  const afterDelete = await request(app)
    .get(`/api/accounts/${accountId}/import-presets`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(afterDelete.body.length, 0);

  const previewNoMatch = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import/columns/preview`)
    .set("Authorization", `Bearer ${token}`)
    .send({ csv });
  assert.equal(previewNoMatch.body.matchingPresetId, null);
});

test("import presets and description rules return 404 for another user", async () => {
  const token = await registerAndLogin(
    "idorpresets@test.local",
    "idorpresets",
    "password123",
  );
  const otherToken = await registerAndLogin(
    "idorpresets2@test.local",
    "idorpresets2",
    "password123",
  );

  const account = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "IDOR Preset Bank",
      accountType: "BANK",
      currency: "PLN",
      openingBalance: 0,
    });
  assert.equal(account.status, 201);
  const accountId = account.body.id as number;

  const preset = await request(app)
    .post(`/api/accounts/${accountId}/import-presets`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "Secret preset",
      headers: ["Date", "Amount"],
      columnMapping: {
        occurredAt: 0,
        amount: 1,
        amountSignMode: "negativeIsExpense",
      },
    });
  assert.equal(preset.status, 201);
  const presetId = preset.body.id as number;

  const listForeign = await request(app)
    .get(`/api/accounts/${accountId}/import-presets`)
    .set("Authorization", `Bearer ${otherToken}`);
  assert.equal(listForeign.status, 404);

  const patchForeign = await request(app)
    .patch(`/api/accounts/${accountId}/import-presets/${presetId}`)
    .set("Authorization", `Bearer ${otherToken}`)
    .send({ name: "Hijack" });
  assert.equal(patchForeign.status, 404);

  const deleteForeign = await request(app)
    .delete(`/api/accounts/${accountId}/import-presets/${presetId}`)
    .set("Authorization", `Bearer ${otherToken}`);
  assert.equal(deleteForeign.status, 404);

  const cats = await request(app)
    .get("/api/categories")
    .set("Authorization", `Bearer ${token}`);
  const food = (cats.body as Array<{ id: number; name: string }>).find(
    (c) => c.name === "Food",
  );
  assert.ok(food);

  const rule = await request(app)
    .post("/api/category-description-rules")
    .set("Authorization", `Bearer ${token}`)
    .send({
      pattern: "secret merchant",
      ledgerType: "EXPENSE",
      categoryId: food!.id,
    });
  assert.equal(rule.status, 201);
  const ruleId = rule.body.id as number;

  const patchRule = await request(app)
    .patch(`/api/category-description-rules/${ruleId}`)
    .set("Authorization", `Bearer ${otherToken}`)
    .send({ pattern: "hijack" });
  assert.equal(patchRule.status, 404);

  const deleteRule = await request(app)
    .delete(`/api/category-description-rules/${ruleId}`)
    .set("Authorization", `Bearer ${otherToken}`);
  assert.equal(deleteRule.status, 404);

  const otherList = await request(app)
    .get("/api/category-description-rules")
    .set("Authorization", `Bearer ${otherToken}`);
  assert.equal(otherList.status, 200);
  assert.equal(
    (otherList.body as Array<{ id: number }>).some((r) => r.id === ruleId),
    false,
  );
});

test("cash ledger CSV import skips duplicates and records ImportBatch", async () => {
  const token = await registerAndLogin(
    "csvdedup@test.local",
    "csvdedup",
    "password123",
  );
  const account = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "Dedup Bank",
      accountType: "BANK",
      currency: "PLN",
      openingBalance: 0,
    });
  assert.equal(account.status, 201);
  const accountId = account.body.id as number;

  const header =
    "id,type,amount,currency,occurredAt,description,categoryPath,createdAt";
  const csv = [
    header,
    `,INCOME,50.00,PLN,2024-03-01T12:00:00.000Z,Pay,,`,
    `,EXPENSE,20.00,PLN,2024-03-02T12:00:00.000Z,Lunch,,`,
    `,EXPENSE,20.00,PLN,2024-03-02T12:00:00.000Z,Lunch,,`,
  ].join("\n");

  const firstPreview = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import/preview`)
    .set("Authorization", `Bearer ${token}`)
    .send({ csv });
  assert.equal(firstPreview.status, 200);
  assert.equal(firstPreview.body.rowCount, 2);
  assert.equal(firstPreview.body.duplicateCount, 1);
  assert.equal(firstPreview.body.skippedDuplicates.length, 1);
  assert.equal(firstPreview.body.skippedDuplicates[0].row, 3);

  const first = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      csv,
      categoryMappings: [],
      descriptionMappings: noneDescriptionMappings(
        firstPreview.body.descriptionSuggestions,
      ),
    });
  assert.equal(first.status, 201);
  assert.equal(first.body.created, 2);
  assert.equal(first.body.duplicateCount, 1);

  const secondPreview = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import/preview`)
    .set("Authorization", `Bearer ${token}`)
    .send({ csv });
  assert.equal(secondPreview.status, 200);
  assert.equal(secondPreview.body.rowCount, 0);
  assert.equal(secondPreview.body.duplicateCount, 3);

  const second = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import`)
    .set("Authorization", `Bearer ${token}`)
    .send({ csv, categoryMappings: [] });
  assert.equal(second.status, 201);
  assert.equal(second.body.created, 0);
  assert.equal(second.body.duplicateCount, 3);
  assert.equal(second.body.skippedDuplicates.length, 3);

  const listed = await request(app)
    .get(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(listed.body.items.length, 2);

  const mixCsv = [
    header,
    `,INCOME,50.00,PLN,2024-03-01T12:00:00.000Z,Pay,,`,
    `,EXPENSE,7.00,PLN,2024-03-05T12:00:00.000Z,New,,`,
  ].join("\n");
  const mixPreview = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import/preview`)
    .set("Authorization", `Bearer ${token}`)
    .send({ csv: mixCsv });
  const mix = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      csv: mixCsv,
      categoryMappings: [],
      descriptionMappings: noneDescriptionMappings(
        mixPreview.body.descriptionSuggestions,
      ),
    });
  assert.equal(mix.status, 201);
  assert.equal(mix.body.created, 1);
  assert.equal(mix.body.duplicateCount, 1);

  const colsCsv = [
    "Date,Amount,Memo",
    "2024-03-05,-7.00,New",
    "2024-03-06,3.00,Fresh",
  ].join("\n");
  const colsMap = {
    occurredAt: 0,
    amount: 1,
    description: 2,
    amountSignMode: "negativeIsExpense",
  };
  const colsApply = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import/columns/apply`)
    .set("Authorization", `Bearer ${token}`)
    .send({ csv: colsCsv, columnMapping: colsMap });
  const colsCommit = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import/columns/commit`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      csv: colsCsv,
      columnMapping: colsMap,
      categoryMappings: [],
      descriptionMappings: noneDescriptionMappings(
        colsApply.body.descriptionSuggestions,
      ),
    });
  assert.equal(colsCommit.status, 201);
  assert.equal(colsCommit.body.created, 1);
  assert.equal(colsCommit.body.duplicateCount, 1);
  assert.equal(colsCommit.body.skippedDuplicates[0].description, "New");
});

test("import description suggestions: history, rules win, commit upserts rule", async () => {
  const token = await registerAndLogin(
    "descsuggest@test.local",
    "descsuggest",
    "password123",
  );
  const account = await request(app)
    .post("/api/accounts")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "Suggest Bank",
      accountType: "BANK",
      currency: "PLN",
      openingBalance: 0,
    });
  assert.equal(account.status, 201);
  const accountId = account.body.id as number;

  const cats = await request(app)
    .get("/api/categories")
    .set("Authorization", `Bearer ${token}`);
  const food = (cats.body as Array<{ id: number; name: string }>).find(
    (c) => c.name === "Food",
  );
  const salary = (cats.body as Array<{ id: number; name: string }>).find(
    (c) => c.name === "Salary",
  );
  assert.ok(food);
  assert.ok(salary);

  await request(app)
    .post(`/api/accounts/${accountId}/transactions`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      type: "EXPENSE",
      amount: 12,
      description: "Zabka",
      categoryId: food!.id,
      occurredAt: "2025-06-01T12:00:00.000Z",
    });

  const header =
    "id,type,amount,currency,occurredAt,description,categoryPath,createdAt";
  const histCsv = `${header}\n,EXPENSE,8.00,PLN,2026-01-10T12:00:00.000Z,Zabka,,\n`;
  const histPreview = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import/preview`)
    .set("Authorization", `Bearer ${token}`)
    .send({ csv: histCsv });
  assert.equal(histPreview.status, 200);
  assert.equal(histPreview.body.descriptionSuggestions.length, 1);
  assert.equal(
    histPreview.body.descriptionSuggestions[0].suggestedCategoryId,
    food!.id,
  );
  assert.equal(
    histPreview.body.descriptionSuggestions[0].suggestionSource,
    "history",
  );

  const emptyDescCsv = `${header}\n,EXPENSE,1.00,PLN,2026-01-11T12:00:00.000Z,,,\n`;
  const emptyDescPreview = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import/preview`)
    .set("Authorization", `Bearer ${token}`)
    .send({ csv: emptyDescCsv });
  assert.equal(emptyDescPreview.body.descriptionSuggestions.length, 0);

  const ruleCreate = await request(app)
    .post("/api/category-description-rules")
    .set("Authorization", `Bearer ${token}`)
    .send({
      pattern: "zabka",
      ledgerType: "EXPENSE",
      categoryId: food!.id,
    });
  assert.equal(ruleCreate.status, 201);
  const ruleId = ruleCreate.body.id as number;

  const otherCat = await request(app)
    .post("/api/categories")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Snacks", ledgerType: "EXPENSE", parentId: food!.id });
  assert.equal(otherCat.status, 201);

  const longRule = await request(app)
    .post("/api/category-description-rules")
    .set("Authorization", `Bearer ${token}`)
    .send({
      pattern: "zabka express",
      ledgerType: "EXPENSE",
      categoryId: otherCat.body.id,
    });
  assert.equal(longRule.status, 201);

  const containsCsv = `${header}\n,EXPENSE,9.00,PLN,2026-01-12T12:00:00.000Z,Zabka Express downtown,,\n`;
  const containsPreview = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import/preview`)
    .set("Authorization", `Bearer ${token}`)
    .send({ csv: containsCsv });
  assert.equal(
    containsPreview.body.descriptionSuggestions[0].suggestedCategoryId,
    otherCat.body.id,
  );
  assert.equal(
    containsPreview.body.descriptionSuggestions[0].suggestionSource,
    "rule",
  );

  const mapCommit = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      csv: histCsv,
      categoryMappings: [],
      descriptionMappings: [
        {
          descriptionKey: "zabka",
          ledgerType: "EXPENSE",
          action: "map",
          categoryId: food!.id,
        },
      ],
    });
  assert.equal(mapCommit.status, 201);
  assert.equal(mapCommit.body.created, 1);

  const rules = await request(app)
    .get("/api/category-description-rules")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(rules.status, 200);
  const exact = (
    rules.body as Array<{ pattern: string; categoryId: number }>
  ).find((r) => r.pattern === "zabka");
  assert.ok(exact);
  assert.equal(exact!.categoryId, food!.id);

  const patched = await request(app)
    .patch(`/api/category-description-rules/${ruleId}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ categoryId: otherCat.body.id });
  assert.equal(patched.status, 200);
  assert.equal(patched.body.categoryId, otherCat.body.id);

  const deleted = await request(app)
    .delete(`/api/category-description-rules/${longRule.body.id}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(deleted.status, 204);

  const incomeCsv = `${header}\n,INCOME,100.00,PLN,2026-02-01T12:00:00.000Z,Monthly pay,,\n`;
  const incomePreview = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import/preview`)
    .set("Authorization", `Bearer ${token}`)
    .send({ csv: incomeCsv });
  assert.equal(incomePreview.body.descriptionSuggestions[0].suggestionSource, null);
  const incomeCommit = await request(app)
    .post(`/api/accounts/${accountId}/transactions/import`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      csv: incomeCsv,
      categoryMappings: [],
      descriptionMappings: [
        {
          descriptionKey: "monthly pay",
          ledgerType: "INCOME",
          action: "map",
          categoryId: salary!.id,
        },
      ],
    });
  assert.equal(incomeCommit.status, 201);
  const rulesAfter = await request(app)
    .get("/api/category-description-rules")
    .set("Authorization", `Bearer ${token}`);
  assert.ok(
    (rulesAfter.body as Array<{ pattern: string }>).some(
      (r) => r.pattern === "monthly pay",
    ),
  );
});
