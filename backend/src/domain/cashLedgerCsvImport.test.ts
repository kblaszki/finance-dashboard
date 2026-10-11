import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCashLedgerCsv,
  CASH_LEDGER_CSV_HEADER,
  LEGACY_CASH_LEDGER_CSV_HEADER,
} from "./cashLedgerCsv";
import {
  formatImportErrors,
  parseCashLedgerCsvImport,
} from "./cashLedgerCsvImport";

describe("parseCashLedgerCsvImport", () => {
  it("accepts header-only CSV", () => {
    const result = parseCashLedgerCsvImport(`${CASH_LEDGER_CSV_HEADER}\n`, "EUR");
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.drafts.length, 0);
  });

  it("parses export round-trip rows and ignores id/createdAt", () => {
    const csv = buildCashLedgerCsv({
      currency: "EUR",
      rows: [
        {
          id: 99,
          type: "INCOME",
          amount: 100.5,
          occurredAt: "2024-06-15T12:00:00.000Z",
          description: "Pay, bonus",
          categoryPath: "Salary",
          createdAt: "2024-06-15T12:01:00.000Z",
        },
      ],
    });
    const result = parseCashLedgerCsvImport(csv, "eur");
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.drafts.length, 1);
    const row = result.drafts[0]!;
    assert.equal(row.type, "INCOME");
    assert.equal(row.amount, 100.5);
    assert.equal(row.description, "Pay, bonus");
    assert.deepEqual(row.categoryPath, ["Salary"]);
    assert.equal(row.occurredAt.toISOString(), "2024-06-15T12:00:00.000Z");
  });

  it("requires currency and accepts a category path", () => {
    const named = [
      CASH_LEDGER_CSV_HEADER,
      ",EXPENSE,10.00,PLN,2024-01-01T00:00:00.000Z,Coffee,Food,",
    ].join("\n");
    const result = parseCashLedgerCsvImport(named, "PLN");
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.drafts[0]!.categoryPath, ["Food"]);

    const emptyCurrency = [
      CASH_LEDGER_CSV_HEADER,
      ",EXPENSE,10.00,,2024-01-01T00:00:00.000Z,Coffee,,",
    ].join("\n");
    const rejected = parseCashLedgerCsvImport(emptyCurrency, "PLN");
    assert.equal(rejected.ok, false);
    if (rejected.ok) return;
    assert.match(rejected.errors[0]!.message, /currency/);
  });

  it("restores formula text after export escaping", () => {
    const csv = buildCashLedgerCsv({
      currency: "PLN",
      rows: [
        {
          id: 1,
          type: "EXPENSE",
          amount: 2,
          occurredAt: "2024-01-01T00:00:00.000Z",
          description: "\t=1+1",
          categoryPath: null,
          createdAt: "2024-01-01T00:00:00.000Z",
        },
      ],
    });
    const result = parseCashLedgerCsvImport(csv, "PLN");
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.drafts[0]!.description, "\t=1+1");
  });

  it("rejects currency mismatch and bad type", () => {
    const csv = [
      CASH_LEDGER_CSV_HEADER,
      ",INCOME,1.00,USD,2024-01-01T00:00:00.000Z,,,",
      ",FOO,1.00,EUR,2024-01-01T00:00:00.000Z,,,",
    ].join("\n");
    const result = parseCashLedgerCsvImport(csv, "EUR");
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.errors.length, 2);
    assert.match(result.errors[0]!.message, /currency/);
    assert.match(result.errors[1]!.message, /type/);
  });

  it("rejects wrong header", () => {
    const result = parseCashLedgerCsvImport("a,b,c\n", "EUR");
    assert.equal(result.ok, false);
  });

  it("rejects legacy categoryId/categoryName header", () => {
    const result = parseCashLedgerCsvImport(
      `${LEGACY_CASH_LEDGER_CSV_HEADER}\n`,
      "EUR",
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.errors[0]!.message, /re-export/i);
  });

  it("parses nested category paths", () => {
    const csv = [
      CASH_LEDGER_CSV_HEADER,
      ",EXPENSE,10.00,PLN,2024-01-01T00:00:00.000Z,Shop,Food/Groceries,",
    ].join("\n");
    const result = parseCashLedgerCsvImport(csv, "PLN");
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.drafts[0]!.categoryPath, ["Food", "Groceries"]);
  });
});

describe("formatImportErrors", () => {
  it("formats single and multiple errors", () => {
    assert.equal(
      formatImportErrors([{ row: 0, message: "CSV header required" }]),
      "CSV header required",
    );
    assert.equal(
      formatImportErrors([{ row: 2, message: "bad amount" }]),
      "Row 2: bad amount",
    );
    assert.match(
      formatImportErrors([
        { row: 1, message: "a" },
        { row: 2, message: "b" },
      ]),
      /Row 1: a; Row 2: b/,
    );
  });
});
