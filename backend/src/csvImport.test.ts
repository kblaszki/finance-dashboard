import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCsvPreview,
  computeTransactionImportHash,
  mapCsvRows,
  parseCsvText,
} from "./csvImport";
import { getCsvPreset } from "./csvPresets";

const MBANK_SAMPLE = `"Data operacji","Kwota","Opis operacji","Typ operacji"
"15.03.2024","-42,50","Biedronka","Wydatek"
"01.03.2024","8500,00","Wynagrodzenie","Przychód"`;

test("parseCsvText handles quoted fields with commas", () => {
  const csv = `"Data","Opis","Kwota"
"01.01.2024","Zakup, spożywczy","-10,5"`;
  const { headers, rows } = parseCsvText(csv);
  assert.deepEqual(headers, ["Data", "Opis", "Kwota"]);
  assert.equal(rows[0]![1], "Zakup, spożywczy");
});

test("mapCsvRows parses Polish dates and comma decimals", () => {
  const { headers, rows } = parseCsvText(
    `Data,Kwota,Opis
15.03.2024,"-123,45",Kawa
2024-06-01,10.5,Premia`,
  );
  const result = mapCsvRows(headers, rows, {
    dateColumn: "Data",
    amountColumn: "Kwota",
    descriptionColumn: "Opis",
  });
  assert.equal(result.errors.length, 0);
  assert.equal(result.rows[0]!.date, "2024-03-15");
  assert.equal(result.rows[0]!.amount, 123.45);
  assert.equal(result.rows[0]!.type, "EXPENSE");
  assert.equal(result.rows[1]!.type, "INCOME");
});

test("mBank preset parses sample export", () => {
  const preset = getCsvPreset("mbank");
  assert.ok(preset);
  const { headers, rows } = parseCsvText(MBANK_SAMPLE);
  const result = mapCsvRows(headers, rows, preset!.mapping);
  assert.equal(result.errors.length, 0);
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0]!.type, "EXPENSE");
  assert.equal(result.rows[0]!.amount, 42.5);
  assert.equal(result.rows[1]!.type, "INCOME");
});

test("buildCsvPreview caps rows and sums amounts", () => {
  const lines = ["Data,Kwota", "2024-01-01,-10", "2024-01-02,20"];
  for (let i = 0; i < 60; i++) lines.push(`2024-01-03,-1`);
  const { headers, rows: dataRows } = parseCsvText(lines.join("\n"));
  const preview = buildCsvPreview(headers, dataRows, {
    dateColumn: "Data",
    amountColumn: "Kwota",
  });
  assert.equal(preview.rows.length, 50);
  assert.equal(preview.totalRows, 62);
  assert.ok(preview.expenseSum > 0);
  assert.ok(preview.incomeSum > 0);
});

test("computeTransactionImportHash is stable for duplicate detection", () => {
  const row = {
    date: "2024-03-15",
    amount: 42.5,
    description: "Biedronka",
    type: "EXPENSE" as const,
  };
  const h1 = computeTransactionImportHash(1, row);
  const h2 = computeTransactionImportHash(1, row);
  const h3 = computeTransactionImportHash(2, row);
  assert.equal(h1, h2);
  assert.notEqual(h1, h3);
});

test("idempotency: same row payload yields same hash", () => {
  const a = computeTransactionImportHash(5, {
    date: "2024-01-01",
    amount: 100,
    description: "Test",
    type: "INCOME",
  });
  const b = computeTransactionImportHash(5, {
    date: "2024-01-01",
    amount: 100,
    description: "Test",
    type: "INCOME",
  });
  assert.equal(a, b);
});
