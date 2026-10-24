import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import {
  assertFxCurrency,
  convertMajor,
  formatYmdUtc,
  utcDateFromYmd,
  type GetMidFn,
} from "./fx";

function midMap(mids: Record<string, number>): GetMidFn {
  return async (currency) => {
    const mid = mids[currency];
    if (mid == null) throw new Error(`missing mid ${currency}`);
    return new Prisma.Decimal(mid);
  };
}

test("assertFxCurrency accepts PLN EUR USD and rejects others", () => {
  assert.equal(assertFxCurrency("eur"), "EUR");
  assert.equal(assertFxCurrency("PLN"), "PLN");
  assert.throws(() => assertFxCurrency("GBP"), /FX currency must be/);
});

test("utcDateFromYmd and formatYmdUtc round-trip", () => {
  const d = utcDateFromYmd("2026-03-15");
  assert.equal(d.toISOString(), "2026-03-15T00:00:00.000Z");
  assert.equal(formatYmdUtc(d), "2026-03-15");
  assert.throws(() => utcDateFromYmd("2026-13-01"), /valid calendar/);
});

test("convertMajor same currency is identity", async () => {
  const out = await convertMajor({
    amount: 12.34,
    from: "EUR",
    to: "EUR",
    asOf: utcDateFromYmd("2026-01-10"),
    getMid: midMap({ EUR: 4.3 }),
  });
  assert.equal(out, 12.34);
});

test("convertMajor PLN to EUR and EUR to PLN", async () => {
  const asOf = utcDateFromYmd("2026-01-10");
  const getMid = midMap({ EUR: 4 });
  assert.equal(
    await convertMajor({ amount: 100, from: "PLN", to: "EUR", asOf, getMid }),
    25,
  );
  assert.equal(
    await convertMajor({ amount: 25, from: "EUR", to: "PLN", asOf, getMid }),
    100,
  );
});

test("convertMajor EUR to USD via PLN pivot", async () => {
  const asOf = utcDateFromYmd("2026-01-10");
  const getMid = midMap({ EUR: 4, USD: 4 });
  assert.equal(
    await convertMajor({ amount: 10, from: "EUR", to: "USD", asOf, getMid }),
    10,
  );
  const getMidUneven = midMap({ EUR: 4.5, USD: 4 });
  assert.equal(
    await convertMajor({
      amount: 10,
      from: "EUR",
      to: "USD",
      asOf,
      getMid: getMidUneven,
    }),
    11.25,
  );
});
