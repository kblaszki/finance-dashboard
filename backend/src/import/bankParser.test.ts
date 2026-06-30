import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBankCsv } from "./bankParser";

const MBANK_SAMPLE = `#Data operacji;#Data księgowania;#Opis operacji;#Kwota;#Saldo po operacji;
15.01.2024;15.01.2024;Sklep;-42,50;1000,00
16.01.2024;16.01.2024;Wynagrodzenie;5000,00;6000,00`;

test("parseBankCsv parses mBank semicolon export", () => {
  const { rows, errors } = parseBankCsv("mbank", MBANK_SAMPLE, "PLN");
  assert.equal(errors.length, 0);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.transactionType, "EXPENSE");
  assert.equal(rows[0]?.amount, 42.5);
  assert.equal(rows[1]?.transactionType, "INCOME");
  assert.equal(rows[1]?.amount, 5000);
});

test("parseBankCsv rejects missing header", () => {
  assert.throws(() => parseBankCsv("generic", "foo,bar\n1,2", "PLN"));
});

test("parseBankCsv collects row errors", () => {
  const csv = `Date,Description,Amount
not-a-date,Grocery,-10.00`;
  const { rows, errors } = parseBankCsv("generic", csv, "PLN");
  assert.equal(rows.length, 0);
  assert.equal(errors.length, 1);
});

  const csv = `Date,Description,Amount
2024-02-01,Grocery,-10.00
2024-02-02,Refund,5.50`;
  const { rows, errors } = parseBankCsv("generic", csv, "EUR");
  assert.equal(errors.length, 0);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.currency, "EUR");
});
