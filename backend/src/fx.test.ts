import test from "node:test";
import assert from "node:assert/strict";
import { convertAmount, getMissingCurrencies, normalizeCurrency } from "./fx";

const MOCK_RATES: Record<string, number> = { PLN: 1, USD: 4, EUR: 4.3 };

test("normalizeCurrency trims and uppercases", () => {
  assert.equal(normalizeCurrency(" usd "), "USD");
  assert.equal(normalizeCurrency("pln"), "PLN");
});

test("convertAmount same currency returns identity", () => {
  assert.equal(convertAmount(100, "PLN", "PLN", MOCK_RATES), 100);
  assert.equal(convertAmount(50, "USD", "USD", MOCK_RATES), 50);
});

test("convertAmount PLN to USD", () => {
  assert.equal(convertAmount(400, "PLN", "USD", MOCK_RATES), 100);
});

test("convertAmount USD to EUR cross-rate", () => {
  const result = convertAmount(100, "USD", "EUR", MOCK_RATES);
  assert.ok(Math.abs(result - (100 * 4) / 4.3) < 0.0001);
});

test("convertAmount rejects missing rate", () => {
  assert.throws(() => convertAmount(100, "XYZ", "PLN", MOCK_RATES));
  assert.throws(() => convertAmount(100, "PLN", "XYZ", MOCK_RATES));
});

test("convertAmount rejects non-finite amount", () => {
  assert.throws(() => convertAmount(NaN, "PLN", "USD", MOCK_RATES));
});

test("getMissingCurrencies", () => {
  assert.deepEqual(getMissingCurrencies(["USD", "XYZ"], MOCK_RATES), ["XYZ"]);
  assert.deepEqual(getMissingCurrencies(["PLN", "USD"], MOCK_RATES), []);
});
