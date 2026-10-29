import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { utcDateFromYmd, type GetMidFn } from "./fx";
import {
  accountTypeToBucket,
  aggregateNetWorth,
  NET_WORTH_BUCKETS,
  valuationDateForMonth,
  type GetMidRowFn,
} from "./netWorth";

function midMap(mids: Record<string, number>): {
  getMid: GetMidFn;
  getMidRow: GetMidRowFn;
} {
  const getMid: GetMidFn = async (currency) => {
    const mid = mids[currency];
    if (mid == null) throw new Error(`missing mid ${currency}`);
    return new Prisma.Decimal(mid);
  };
  const getMidRow: GetMidRowFn = async (currency) => {
    const mid = await getMid(currency, utcDateFromYmd("2026-01-10"));
    return { mid, rateDate: utcDateFromYmd("2026-01-09") };
  };
  return { getMid, getMidRow };
}

test("accountTypeToBucket maps known types and unknowns to other", () => {
  assert.equal(accountTypeToBucket("BANK"), "cash");
  assert.equal(accountTypeToBucket("brokerage"), "stock");
  assert.equal(accountTypeToBucket("CRYPTO"), "crypto");
  assert.equal(accountTypeToBucket("PRECIOUS_METAL"), "metal");
  assert.equal(accountTypeToBucket("REAL_ESTATE"), "real_estate");
  assert.equal(accountTypeToBucket("IKE"), "stock");
  assert.equal(accountTypeToBucket("IKZE"), "stock");
  assert.equal(accountTypeToBucket("TREASURY_BONDS"), "other");
  assert.equal(accountTypeToBucket("OTHER"), "other");
  assert.equal(accountTypeToBucket("MANUAL"), "other");
  assert.equal(accountTypeToBucket("WEIRD"), "other");
});

test("aggregateNetWorth converts foreign balances into reporting currency", async () => {
  const { getMid, getMidRow } = midMap({ EUR: 4, USD: 4 });
  const result = await aggregateNetWorth({
    currency: "PLN",
    asOf: utcDateFromYmd("2026-01-10"),
    getMid,
    getMidRow,
    accounts: [
      { accountType: "BANK", currency: "PLN", cashBalance: 1000 },
      { accountType: "BROKERAGE", currency: "PLN", cashBalance: 2000 },
      { accountType: "CRYPTO", currency: "USD", cashBalance: 100 },
      { accountType: "OTHER", currency: "EUR", cashBalance: 50 },
    ],
  });

  assert.equal(result.currency, "PLN");
  assert.equal(result.asOf, "2026-01-10");
  assert.deepEqual(result.byBucket, {
    cash: 1000,
    stock: 2000,
    crypto: 400,
    metal: 0,
    real_estate: 0,
    other: 200,
  });
  assert.equal(result.liabilities, 0);
  assert.equal(result.netWorth, 3600);
  assert.equal(result.ratesUsed.length, 2);
});

test("aggregateNetWorth can report in EUR via PLN pivot", async () => {
  const { getMid, getMidRow } = midMap({ EUR: 4, USD: 4 });
  const result = await aggregateNetWorth({
    currency: "EUR",
    asOf: utcDateFromYmd("2026-01-10"),
    getMid,
    getMidRow,
    accounts: [
      { accountType: "BANK", currency: "PLN", cashBalance: 400 },
      { accountType: "CRYPTO", currency: "USD", cashBalance: 100 },
    ],
  });
  assert.equal(result.currency, "EUR");
  assert.equal(result.byBucket.cash, 100);
  assert.equal(result.byBucket.crypto, 100);
  assert.equal(result.netWorth, 200);
});

test("aggregateNetWorth treats CREDIT_CARD debt as liabilities after FX", async () => {
  const { getMid, getMidRow } = midMap({ EUR: 4 });
  const result = await aggregateNetWorth({
    currency: "PLN",
    asOf: utcDateFromYmd("2026-01-10"),
    getMid,
    getMidRow,
    accounts: [
      { accountType: "BANK", currency: "PLN", cashBalance: 1000 },
      { accountType: "CREDIT_CARD", currency: "EUR", cashBalance: -50 },
      { accountType: "CREDIT_CARD", currency: "PLN", cashBalance: 40 },
      { accountType: "IKE", currency: "PLN", cashBalance: 500 },
    ],
  });
  assert.equal(result.liabilities, 200);
  assert.deepEqual(result.byBucket, {
    cash: 1040,
    stock: 500,
    crypto: 0,
    metal: 0,
    real_estate: 0,
    other: 0,
  });
  assert.equal(result.netWorth, 1040 + 500 - 200);
});

test("aggregateNetWorth rejects unsupported account currencies", async () => {
  const { getMid } = midMap({});
  await assert.rejects(
    () =>
      aggregateNetWorth({
        currency: "PLN",
        asOf: utcDateFromYmd("2026-01-10"),
        getMid,
        accounts: [
          { accountType: "BANK", currency: "GBP", cashBalance: 10 },
        ],
      }),
    /Unsupported account currency GBP/,
  );
});

test("aggregateNetWorth returns zeros for empty account list", async () => {
  const { getMid } = midMap({});
  const result = await aggregateNetWorth({
    currency: "PLN",
    asOf: utcDateFromYmd("2026-01-10"),
    getMid,
    accounts: [],
  });
  assert.deepEqual(result.byBucket, {
    cash: 0,
    stock: 0,
    crypto: 0,
    metal: 0,
    real_estate: 0,
    other: 0,
  });
  assert.equal(result.netWorth, 0);
  assert.equal(result.ratesUsed.length, 0);
  assert.equal(NET_WORTH_BUCKETS.length, 6);
});

test("valuationDateForMonth uses month-end and rejects future months", () => {
  const today = utcDateFromYmd("2026-03-15");
  assert.equal(
    valuationDateForMonth("2026-01", today).toISOString(),
    "2026-01-31T00:00:00.000Z",
  );
  assert.equal(
    valuationDateForMonth("2026-03", today).toISOString(),
    "2026-03-15T00:00:00.000Z",
  );
  assert.throws(() => valuationDateForMonth("2026-04", today), /future/);
});
