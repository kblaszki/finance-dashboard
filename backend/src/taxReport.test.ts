import test from "node:test";
import assert from "node:assert/strict";
import { aggregateRealizedAmounts, formatTaxReportCsv, parseTaxYear } from "./taxReport";

test("aggregateRealizedAmounts splits gains and losses", () => {
  const result = aggregateRealizedAmounts([100, -30, 50, -20]);
  assert.equal(result.realizedGains, 150);
  assert.equal(result.realizedLosses, 50);
  assert.equal(result.netRealized, 100);
  assert.equal(result.estimatedBelka, 19);
});

test("aggregateRealizedAmounts belka is zero when net loss", () => {
  const result = aggregateRealizedAmounts([40, -100]);
  assert.equal(result.netRealized, -60);
  assert.equal(result.estimatedBelka, 0);
});

test("parseTaxYear accepts valid years and rejects invalid values", () => {
  assert.equal(parseTaxYear("2025"), 2025);
  assert.equal(parseTaxYear(2020), 2020);
  assert.throws(() => parseTaxYear("2025.5"), /year must be/);
  assert.throws(() => parseTaxYear("1999"), /year must be/);
  assert.throws(() => parseTaxYear("2101"), /year must be/);
});

test("formatTaxReportCsv escapes account names", () => {
  const csv = formatTaxReportCsv([
    {
      saleDate: "2025-03-15T12:00:00.000Z",
      symbol: "PKO",
      accountId: 1,
      accountName: 'Broker "XTB"',
      quantity: 10,
      proceeds: 500,
      cost: 400,
      gainLoss: 100,
      currency: "PLN",
    },
  ]);
  assert.ok(csv.includes("saleDate,symbol,account"));
  assert.ok(csv.includes('"Broker ""XTB"""'));
});
