import test from "node:test";
import assert from "node:assert/strict";
import {
  accountTypeToBucket,
  aggregateNetWorth,
  NET_WORTH_BUCKETS,
} from "./netWorth";

test("accountTypeToBucket maps known types and unknowns to other", () => {
  assert.equal(accountTypeToBucket("BANK"), "cash");
  assert.equal(accountTypeToBucket("brokerage"), "stock");
  assert.equal(accountTypeToBucket("CRYPTO"), "crypto");
  assert.equal(accountTypeToBucket("PRECIOUS_METAL"), "metal");
  assert.equal(accountTypeToBucket("REAL_ESTATE"), "real_estate");
  assert.equal(accountTypeToBucket("OTHER"), "other");
  assert.equal(accountTypeToBucket("MANUAL"), "other");
  assert.equal(accountTypeToBucket("WEIRD"), "other");
});

test("aggregateNetWorth sums cashBalance by bucket for one currency", () => {
  const result = aggregateNetWorth("PLN", [
    { accountType: "BANK", currency: "PLN", cashBalance: 1000 },
    { accountType: "BANK", currency: "PLN", cashBalance: 500 },
    { accountType: "BROKERAGE", currency: "PLN", cashBalance: 2000 },
    { accountType: "CRYPTO", currency: "USD", cashBalance: 999 },
    { accountType: "OTHER", currency: "PLN", cashBalance: 50 },
    { accountType: "MANUAL", currency: "PLN", cashBalance: 25 },
    { accountType: "PRECIOUS_METAL", currency: "PLN", cashBalance: 10 },
    { accountType: "REAL_ESTATE", currency: "PLN", cashBalance: 100 },
  ]);

  assert.equal(result.currency, "PLN");
  assert.equal(result.liabilities, 0);
  assert.deepEqual(result.byBucket, {
    cash: 1500,
    stock: 2000,
    crypto: 0,
    metal: 10,
    real_estate: 100,
    other: 75,
  });
  const bucketSum = NET_WORTH_BUCKETS.reduce(
    (sum, key) => sum + result.byBucket[key],
    0,
  );
  assert.equal(result.netWorth, bucketSum);
  assert.equal(result.netWorth, 3685);
});

test("aggregateNetWorth returns zeros for unused currency", () => {
  const result = aggregateNetWorth("EUR", [
    { accountType: "BANK", currency: "PLN", cashBalance: 1000 },
  ]);
  assert.deepEqual(result, {
    currency: "EUR",
    byBucket: {
      cash: 0,
      stock: 0,
      crypto: 0,
      metal: 0,
      real_estate: 0,
      other: 0,
    },
    liabilities: 0,
    netWorth: 0,
  });
});
