import test from "node:test";
import assert from "node:assert/strict";
import {
  detectDelimiter,
  normalizeMappedRows,
  parseColumnMapping,
  parseDelimitedTable,
  parseFlexibleDate,
  parseSignedAmount,
  suggestColumnMapping,
} from "./csvColumnMap";

test("detectDelimiter prefers semicolon when dominant", () => {
  assert.equal(detectDelimiter("Data;Kwota;Opis"), ";");
  assert.equal(detectDelimiter("Date,Amount,Description"), ",");
  assert.equal(detectDelimiter("Date\tAmount\tDescription"), "\t");
});

test("parseDelimitedTable splits semicolon CSV", () => {
  const table = parseDelimitedTable(
    "Data;Kwota;Opis\n15.01.2026;-12,50;Sklep\n16.01.2026;100,00;Wpłata\n",
  );
  assert.equal(table.delimiter, ";");
  assert.deepEqual(table.headers, ["Data", "Kwota", "Opis"]);
  assert.equal(table.rows.length, 2);
  assert.equal(table.rows[0]![1], "-12,50");
});

test("suggestColumnMapping matches Polish/English hints", () => {
  const s = suggestColumnMapping(["Data operacji", "Kwota", "Tytuł", "Kategoria"]);
  assert.equal(s.occurredAt, 0);
  assert.equal(s.amount, 1);
  assert.equal(s.description, 2);
  assert.equal(s.categoryPath, 3);
  assert.equal(s.amountSignMode, "negativeIsExpense");
});

test("parseSignedAmount handles EU decimals", () => {
  assert.equal(parseSignedAmount("-12,50"), -12.5);
  assert.equal(parseSignedAmount("1.234,56"), 1234.56);
  assert.equal(parseSignedAmount("12.50"), 12.5);
});

test("parseFlexibleDate accepts DMY and ISO day", () => {
  const dmy = parseFlexibleDate("15.01.2026");
  assert.ok(dmy);
  assert.equal(dmy!.toISOString().slice(0, 10), "2026-01-15");
  const iso = parseFlexibleDate("2026-01-15");
  assert.equal(iso!.toISOString().slice(0, 10), "2026-01-15");
});

test("normalizeMappedRows negativeIsExpense vs negativeIsIncome", () => {
  const table = parseDelimitedTable(
    "Date,Amount\n2026-01-10,-20\n2026-01-11,30\n",
  );
  const bank = normalizeMappedRows(table, {
    occurredAt: 0,
    amount: 1,
    amountSignMode: "negativeIsExpense",
  });
  assert.ok(bank.ok);
  if (bank.ok) {
    assert.equal(bank.drafts[0]!.type, "EXPENSE");
    assert.equal(bank.drafts[0]!.amount, 20);
    assert.equal(bank.drafts[1]!.type, "INCOME");
    assert.equal(bank.drafts[1]!.amount, 30);
  }

  const card = normalizeMappedRows(table, {
    occurredAt: 0,
    amount: 1,
    amountSignMode: "negativeIsIncome",
  });
  assert.ok(card.ok);
  if (card.ok) {
    assert.equal(card.drafts[0]!.type, "INCOME");
    assert.equal(card.drafts[1]!.type, "EXPENSE");
  }
});

test("normalizeMappedRows type column overrides sign", () => {
  const table = parseDelimitedTable(
    "Date,Amount,Type\n2026-01-10,-20,INCOME\n",
  );
  const result = normalizeMappedRows(table, {
    occurredAt: 0,
    amount: 1,
    type: 2,
  });
  assert.ok(result.ok);
  if (result.ok) {
    assert.equal(result.drafts[0]!.type, "INCOME");
    assert.equal(result.drafts[0]!.amount, 20);
  }
});

test("parseColumnMapping requires amountSignMode without type", () => {
  assert.throws(
    () => parseColumnMapping({ occurredAt: 0, amount: 1 }, ["Date", "Amount"]),
    /amountSignMode is required/,
  );
  const ok = parseColumnMapping(
    {
      occurredAt: "Date",
      amount: "Amount",
      amountSignMode: "negativeIsIncome",
    },
    ["Date", "Amount"],
  );
  assert.equal(ok.amountSignMode, "negativeIsIncome");
});
