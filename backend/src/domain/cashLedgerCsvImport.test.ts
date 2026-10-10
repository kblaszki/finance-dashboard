import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCashLedgerCsv, CASH_LEDGER_CSV_HEADER } from "./cashLedgerCsv";
import {
  formatImportErrors,
  parseCashLedgerCsvImport,
  resolveImportCategoryIds,
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
          categoryId: 7,
          categoryName: "Salary",
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
    assert.equal(row.categoryId, 7);
    assert.equal(row.categoryName, null);
    assert.equal(row.occurredAt.toISOString(), "2024-06-15T12:00:00.000Z");
  });

  it("requires currency and accepts a name-only category", () => {
    const named = [
      CASH_LEDGER_CSV_HEADER,
      ",EXPENSE,10.00,PLN,2024-01-01T00:00:00.000Z,Coffee,,Food,",
    ].join("\n");
    const result = parseCashLedgerCsvImport(named, "PLN");
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.drafts[0]!.categoryId, null);
    assert.equal(result.drafts[0]!.categoryName, "Food");

    const emptyCurrency = [
      CASH_LEDGER_CSV_HEADER,
      ",EXPENSE,10.00,,2024-01-01T00:00:00.000Z,Coffee,,,",
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
          categoryId: null,
          categoryName: null,
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
      ",INCOME,1.00,USD,2024-01-01T00:00:00.000Z,,,,",
      ",FOO,1.00,EUR,2024-01-01T00:00:00.000Z,,,,",
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
});

describe("resolveImportCategoryIds", () => {
  const cats = [
    { id: 1, name: "Income", ledgerType: "INCOME" },
    { id: 2, name: "Food", ledgerType: "EXPENSE" },
    { id: 3, name: "Food", ledgerType: "EXPENSE" },
    { id: 4, name: "Salary", ledgerType: "INCOME" },
  ];

  it("keeps owned categoryId and resolves unique name", () => {
    const parsed = parseCashLedgerCsvImport(
      [
        CASH_LEDGER_CSV_HEADER,
        ",INCOME,1.00,EUR,2024-01-01T00:00:00.000Z,,1,Income,",
        ",INCOME,2.00,EUR,2024-01-02T00:00:00.000Z,,,Salary,",
      ].join("\n"),
      "EUR",
    );
    assert.ok(parsed.ok);
    if (!parsed.ok) return;
    const resolved = resolveImportCategoryIds(parsed.drafts, cats);
    assert.equal(resolved.ok, true);
    if (!resolved.ok) return;
    assert.equal(resolved.rows[0]!.categoryId, 1);
    assert.equal(resolved.rows[1]!.categoryId, 4);
  });

  it("rejects ledgerType mismatch", () => {
    const drafts = [
      {
        row: 1,
        type: "EXPENSE" as const,
        amount: 1,
        occurredAt: new Date("2024-01-01T00:00:00.000Z"),
        description: null,
        categoryId: 1,
        categoryName: null,
      },
    ];
    const resolved = resolveImportCategoryIds(drafts, cats);
    assert.equal(resolved.ok, false);
    if (resolved.ok) return;
    assert.match(resolved.errors[0]!.message, /ledgerType/);
  });

  it("rejects unknown id and ambiguous name", () => {
    const drafts = [
      {
        row: 1,
        type: "EXPENSE" as const,
        amount: 1,
        occurredAt: new Date("2024-01-01T00:00:00.000Z"),
        description: null,
        categoryId: 99,
        categoryName: null,
      },
      {
        row: 2,
        type: "EXPENSE" as const,
        amount: 1,
        occurredAt: new Date("2024-01-01T00:00:00.000Z"),
        description: null,
        categoryId: null,
        categoryName: "Food",
      },
    ];
    const resolved = resolveImportCategoryIds(drafts, cats);
    assert.equal(resolved.ok, false);
    if (resolved.ok) return;
    assert.equal(resolved.errors.length, 2);
    assert.match(resolved.errors[0]!.message, /not found/);
    assert.match(resolved.errors[1]!.message, /ambiguous/);
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
