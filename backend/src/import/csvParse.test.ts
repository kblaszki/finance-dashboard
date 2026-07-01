import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsvTable, parseNumeric, rowToRecord } from "./csvParse";

test("parseCsvTable strips BOM and detects comma delimiter", () => {
  const csv = `\uFEFFDate,Symbol,Amount
2026-01-01,ABC,10.5`;
  const table = parseCsvTable(csv);
  assert.equal(table.delimiter, ",");
  assert.equal(table.headers.length, 3);
  assert.equal(table.rows.length, 1);
});

test("parseCsvTable parses quoted fields with escaped quotes", () => {
  const csv = `ID;Type;Time;Comment;Symbol;Amount
1;Deposit;2026-01-01 10:00:00;"Say ""hi"""; ;100.00`;
  const table = parseCsvTable(csv);
  assert.equal(table.rows.length, 1);
  const rec = rowToRecord(table.headers, table.rows[0]!);
  assert.equal(rec.comment, 'Say "hi"');
});

test("parseNumeric handles spaces and comma decimals", () => {
  assert.equal(parseNumeric("1 234,56"), 1234.56);
  assert.equal(parseNumeric(""), null);
  assert.equal(parseNumeric("n/a"), null);
});

test("parseCsvTable skips total rows and blank lines", () => {
  const csv = `Symbol;Volume;Open price;Open time;Type
AAA;1;10;2026-01-01;BUY

Total;;

BBB;2;20;2026-01-02;SELL`;
  const table = parseCsvTable(csv);
  assert.equal(table.rows.length, 2);
});
