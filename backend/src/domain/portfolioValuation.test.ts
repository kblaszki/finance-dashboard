import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { utcDateFromYmd } from "./fx";
import {
  holdingsValuesAsOf,
  openQuantitiesAsOf,
  pickLatestCollapsedClose,
} from "./portfolioValuation";
import { VALUATION_SOURCE_TWELVE_DATA, VALUATION_SOURCE_YAHOO } from "./instrumentValuations";

test("pickLatestCollapsedClose prefers yahoo on same day", () => {
  const picked = pickLatestCollapsedClose([
    {
      asOfDate: utcDateFromYmd("2026-01-10"),
      close: 100,
      source: VALUATION_SOURCE_TWELVE_DATA,
    },
    {
      asOfDate: utcDateFromYmd("2026-01-10"),
      close: 101,
      source: VALUATION_SOURCE_YAHOO,
    },
    {
      asOfDate: utcDateFromYmd("2026-01-09"),
      close: 99,
      source: VALUATION_SOURCE_YAHOO,
    },
  ]);
  assert.deepEqual(picked, { asOf: "2026-01-10", close: 101 });
});

test("openQuantitiesAsOf applies BUY/SELL before exclusive bound", () => {
  const qty = openQuantitiesAsOf(
    [
      {
        accountId: 1,
        instrumentId: 7,
        side: "BUY",
        quantity: 10,
        occurredAt: utcDateFromYmd("2026-01-05"),
      },
      {
        accountId: 1,
        instrumentId: 7,
        side: "SELL",
        quantity: 3,
        occurredAt: utcDateFromYmd("2026-01-15"),
      },
      {
        accountId: 1,
        instrumentId: 7,
        side: "BUY",
        quantity: 2,
        occurredAt: utcDateFromYmd("2026-02-01"),
      },
    ],
    utcDateFromYmd("2026-02-01"),
  );
  assert.equal(qty.get("1:7")?.toNumber(), 7);
});

test("holdingsValuesAsOf multiplies open qty by as-of close", () => {
  const values = holdingsValuesAsOf(
    [1],
    [
      {
        accountId: 1,
        instrumentId: 7,
        side: "BUY",
        quantity: new Prisma.Decimal(10),
        occurredAt: utcDateFromYmd("2026-01-01"),
      },
    ],
    [
      {
        instrumentId: 7,
        asOfDate: utcDateFromYmd("2026-01-20"),
        close: 50,
        source: VALUATION_SOURCE_YAHOO,
      },
    ],
    utcDateFromYmd("2026-02-01"),
  );
  assert.equal(values.get(1), 500);
});
