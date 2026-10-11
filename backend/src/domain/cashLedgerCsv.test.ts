import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCashLedgerCsv,
  buildCategoryPathMap,
  cashLedgerExportFilename,
  CASH_LEDGER_CSV_HEADER,
  escapeCsvCell,
  formatCategoryPath,
  parseCategoryPath,
} from "./cashLedgerCsv";

describe("escapeCsvCell", () => {
  it("leaves plain text unchanged", () => {
    assert.equal(escapeCsvCell("hello"), "hello");
  });

  it("quotes commas, quotes, and newlines", () => {
    assert.equal(escapeCsvCell("a,b"), '"a,b"');
    assert.equal(escapeCsvCell('say "hi"'), '"say ""hi"""');
    assert.equal(escapeCsvCell("line1\nline2"), '"line1\nline2"');
  });

  it("prefixes Excel formula-like values with apostrophe", () => {
    assert.equal(escapeCsvCell("=1+1"), "'=1+1");
    assert.equal(escapeCsvCell("+cmd"), "'+cmd");
    assert.equal(escapeCsvCell("-1"), "'-1");
    assert.equal(escapeCsvCell("@sum"), "'@sum");
    assert.equal(escapeCsvCell("\tcmd"), "'\tcmd");
    assert.equal(escapeCsvCell("\r=1"), "\"'\r=1\"");
  });
});

describe("category path helpers", () => {
  it("round-trips segments with escaped slashes and backslashes", () => {
    const segments = ["Food", "A/B", "x\\y"];
    const formatted = formatCategoryPath(segments);
    assert.equal(formatted, "Food/A\\/B/x\\\\y");
    const parsed = parseCategoryPath(formatted);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.deepEqual(parsed.segments, segments);
  });

  it("treats empty path as no category", () => {
    const parsed = parseCategoryPath("  ");
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.deepEqual(parsed.segments, []);
  });

  it("rejects empty segments and invalid escapes", () => {
    assert.equal(parseCategoryPath("Food/").ok, false);
    assert.equal(parseCategoryPath("/Food").ok, false);
    assert.equal(parseCategoryPath("Food\\x").ok, false);
  });

  it("builds id → path map from a tree", () => {
    const map = buildCategoryPathMap([
      { id: 1, name: "Food", parentId: null },
      { id: 2, name: "Groceries", parentId: 1 },
      { id: 3, name: "Salary", parentId: null },
    ]);
    assert.equal(map.get(1), "Food");
    assert.equal(map.get(2), "Food/Groceries");
    assert.equal(map.get(3), "Salary");
  });
});

describe("buildCashLedgerCsv", () => {
  it("returns header-only CSV when rows are empty", () => {
    const csv = buildCashLedgerCsv({ currency: "pln", rows: [] });
    assert.equal(csv, `${CASH_LEDGER_CSV_HEADER}\n`);
  });

  it("encodes rows with currency, category path, and ISO dates", () => {
    const occurredAt = new Date("2024-06-15T12:00:00.000Z");
    const createdAt = new Date("2024-06-15T12:01:00.000Z");
    const csv = buildCashLedgerCsv({
      currency: "eur",
      rows: [
        {
          id: 1,
          type: "INCOME",
          amount: 100.5,
          occurredAt,
          description: "Pay, bonus",
          categoryPath: "Salary",
          createdAt,
        },
        {
          id: 2,
          type: "EXPENSE",
          amount: 10,
          occurredAt: "2024-07-01T00:00:00.000Z",
          description: null,
          categoryPath: null,
          createdAt: "2024-07-01T00:00:01.000Z",
        },
      ],
    });

    const lines = csv.trimEnd().split("\n");
    assert.equal(lines[0], CASH_LEDGER_CSV_HEADER);
    assert.equal(
      lines[1],
      '1,INCOME,100.50,EUR,2024-06-15T12:00:00.000Z,"Pay, bonus",Salary,2024-06-15T12:01:00.000Z',
    );
    assert.equal(
      lines[2],
      "2,EXPENSE,10.00,EUR,2024-07-01T00:00:00.000Z,,,2024-07-01T00:00:01.000Z",
    );
  });
});

describe("cashLedgerExportFilename", () => {
  it("uses ASCII-safe account id filename", () => {
    assert.equal(cashLedgerExportFilename(42), "account-42-cash.csv");
  });
});
