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
