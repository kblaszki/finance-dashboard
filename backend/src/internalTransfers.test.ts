import test from "node:test";
import assert from "node:assert/strict";
import {
  encodeTransferDescription,
  parseTransferDescription,
  validateInternalTransfer,
} from "./internalTransfers";

test("validateInternalTransfer accepts same-currency transfer", () => {
  assert.equal(
    validateInternalTransfer(
      { id: 1, currency: "PLN" },
      { id: 2, currency: "PLN" },
      { fromAmount: 100, toAmount: 100, commission: 0 },
    ),
    null,
  );
});

test("validateInternalTransfer rejects mismatched same-currency amounts", () => {
  const error = validateInternalTransfer(
    { id: 1, currency: "PLN" },
    { id: 2, currency: "PLN" },
    { fromAmount: 100, toAmount: 90 },
  );
  assert.match(error ?? "", /matching/);
});

test("validateInternalTransfer requires exchange rate for cross-currency transfer", () => {
  const error = validateInternalTransfer(
    { id: 1, currency: "USD" },
    { id: 2, currency: "PLN" },
    { fromAmount: 100, toAmount: 400 },
  );
  assert.match(error ?? "", /exchangeRate/);
});

test("validateInternalTransfer rejects identical accounts", () => {
  const error = validateInternalTransfer(
    { id: 1, currency: "PLN" },
    { id: 1, currency: "PLN" },
    { fromAmount: 100, toAmount: 100 },
  );
  assert.match(error ?? "", /differ/);
});

test("parseTransferDescription returns null for invalid payload", () => {
  assert.equal(parseTransferDescription("not-json"), null);
  assert.equal(parseTransferDescription(JSON.stringify({ groupId: "x" })), null);
});

test("transfer description round-trip", () => {
  const meta = {
    groupId: "abc",
    fromAccountId: 1,
    toAccountId: 2,
    fromAmount: 100,
    toAmount: 400,
    fromCurrency: "USD",
    toCurrency: "PLN",
    exchangeRate: 4,
    commission: 5,
  };
  const parsed = parseTransferDescription(encodeTransferDescription(meta));
  assert.deepEqual(parsed, meta);
});
