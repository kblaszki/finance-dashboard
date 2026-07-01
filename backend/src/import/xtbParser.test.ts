import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseXtbCsv } from "./xtbParser";

const FIXTURES = join(__dirname, "..", "..", "test", "fixtures", "import");

test("parseXtbCsv closed positions extracts trades", () => {
  const csv = readFileSync(join(FIXTURES, "xtb-closed-positions.csv"), "utf8");
  const { rows, errors } = parseXtbCsv(csv, "PLN");
  assert.equal(errors.length, 0);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].kind, "trade");
  if (rows[0].kind === "trade") {
    assert.equal(rows[0].symbol, "PKO");
    assert.equal(rows[0].exchange, "GPW");
    assert.equal(rows[0].side, "BUY");
    assert.equal(rows[0].quantity, 10);
    assert.equal(rows[0].pricePerUnit, 45.5);
    assert.equal(rows[0].fee, 2);
  }
  const sell = rows[2];
  assert.equal(sell.kind, "trade");
  if (sell.kind === "trade") {
    assert.equal(sell.side, "SELL");
    assert.equal(sell.quantity, 2);
  }
});

test("parseXtbCsv cash operations extracts cash events", () => {
  const csv = readFileSync(join(FIXTURES, "xtb-cash-operations.csv"), "utf8");
  const { rows, errors } = parseXtbCsv(csv, "PLN");
  assert.equal(rows.length, 4);
  assert.equal(rows.filter((r) => r.kind === "transfer_in").length, 1);
  assert.equal(rows.filter((r) => r.kind === "dividend").length, 1);
  assert.equal(rows.filter((r) => r.kind === "interest").length, 1);
  assert.equal(rows.filter((r) => r.kind === "transfer_out").length, 1);
  assert.ok(errors.length >= 0);
});

test("parseXtbCsv closed positions reports invalid rows", () => {
  const csv = `Position;Symbol;Type;Volume;Open time;Open price;Commission
1;;BUY;10;2025-01-10 10:00:00;45.50;0
2;AAPL.US;HOLD;5;2025-02-01 11:30:00;120.00;0
3;SAP.DE;BUY;0;2025-03-01 12:00:00;50.00;0
4;VOD.UK;BUY;3;invalid;100.00;0`;
  const { rows, errors } = parseXtbCsv(csv, "USD");
  assert.equal(rows.length, 0);
  assert.ok(errors.length >= 4);
});

test("parseXtbCsv maps exchange suffixes and dot dates", () => {
  const csv = `Position;Symbol;Type;Volume;Open time;Open price;Commission
1;AAPL.US;BUY;2;10.01.2025 09:30:00;150.00;1.00
2;SAP.DE;BUY;1;15.02.2025;80.00;0.50`;
  const { rows, errors } = parseXtbCsv(csv, "USD");
  assert.equal(errors.length, 0);
  assert.equal(rows.length, 2);
  const us = rows[0];
  assert.equal(us.kind, "trade");
  if (us.kind === "trade") {
    assert.equal(us.symbol, "AAPL");
    assert.equal(us.exchange, "NASDAQ");
    assert.equal(us.currency, "USD");
  }
  const de = rows[1];
  if (de.kind === "trade") {
    assert.equal(de.exchange, "XETRA");
    assert.equal(de.currency, "EUR");
  }
});

test("parseXtbCsv cash operations parses stock purchase from comment", () => {
  const csv = `ID;Type;Time;Comment;Symbol;Amount
99;Stock purchase;2025-04-01 10:00:00;5 @ 120.50;CDR.PL;-602.50`;
  const { rows, errors } = parseXtbCsv(csv, "PLN");
  assert.equal(errors.length, 0);
  assert.equal(rows.length, 1);
  const trade = rows[0];
  assert.equal(trade.kind, "trade");
  if (trade.kind === "trade") {
    assert.equal(trade.side, "BUY");
    assert.equal(trade.quantity, 5);
    assert.equal(trade.pricePerUnit, 120.5);
  }
});

test("parseXtbCsv cash operations skips unknown operation types", () => {
  const csv = `ID;Type;Time;Comment;Symbol;Amount
1;Mystery fee;2025-05-01 10:00:00;Fee; ;-5.00`;
  const { rows, errors } = parseXtbCsv(csv, "PLN");
  assert.equal(rows.length, 0);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /unknown operation/i);
});

test("parseXtbCsv cash operations parses sale and shares comment", () => {
  const csv = `ID;Type;Time;Comment;Symbol;Amount
1;Stocks/ETF sale;2025-06-01 10:00:00;3 szt @ 50;FOO.PL;150.00
2;Withdrawal;2025-06-02 10:00:00;Cash out; ;200.00`;
  const { rows, errors } = parseXtbCsv(csv, "PLN");
  assert.equal(errors.length, 0);
  assert.equal(rows.length, 2);
  const sale = rows[0];
  assert.equal(sale.kind, "trade");
  if (sale.kind === "trade") {
    assert.equal(sale.side, "SELL");
    assert.equal(sale.quantity, 3);
  }
  assert.equal(rows[1].kind, "transfer_out");
});
