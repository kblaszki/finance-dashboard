import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { utcDateFromYmd, type FxNbpCurrency } from "./fx";
import {
  aggregateNetWorthHistory,
  asOfExclusiveBound,
  balanceMajorAsOf,
  type NetWorthHistoryAccount,
} from "./netWorthHistory";
import type { GetMidRowFn } from "./netWorth";

function midRow(mids: Record<string, number>): GetMidRowFn {
  return async (currency: FxNbpCurrency) => {
    const mid = mids[currency];
    if (mid == null) throw new Error(`missing mid ${currency}`);
    return {
      mid: new Prisma.Decimal(mid),
      rateDate: utcDateFromYmd("2026-01-09"),
    };
  };
}

const bankPln = (
  overrides: Partial<NetWorthHistoryAccount> = {},
): NetWorthHistoryAccount => ({
  accountType: "BANK",
  currency: "PLN",
  openingBalanceMinor: 10_000,
  openingEffectiveAt: utcDateFromYmd("2026-01-15"),
  transactions: [],
  ...overrides,
});

test("balanceMajorAsOf is zero before opening and applies later ledger rows", () => {
  const account = bankPln({
    transactions: [
      {
        type: "INCOME",
        amount: 5_000,
        occurredAt: utcDateFromYmd("2026-01-10"),
      },
      {
        type: "INCOME",
        amount: 2_000,
        occurredAt: utcDateFromYmd("2026-01-20"),
      },
      {
        type: "TRANSFER_OUT",
        amount: 1_000,
        occurredAt: utcDateFromYmd("2026-02-05"),
      },
    ],
  });

  assert.equal(balanceMajorAsOf(account, utcDateFromYmd("2026-01-15")), 0);
  // Opening 100 + income 20 (pre-opening ignored) as of exclusive Feb 1
  assert.equal(balanceMajorAsOf(account, utcDateFromYmd("2026-02-01")), 120);
  assert.equal(balanceMajorAsOf(account, utcDateFromYmd("2026-03-01")), 110);
});

test("asOfExclusiveBound is the next UTC calendar day", () => {
  assert.equal(
    asOfExclusiveBound(utcDateFromYmd("2026-01-31")).toISOString(),
    "2026-02-01T00:00:00.000Z",
  );
});

test("aggregateNetWorthHistory converts multi-currency month-end balances", async () => {
  const result = await aggregateNetWorthHistory({
    currency: "PLN",
    months: ["2026-01", "2026-02"],
    asOfToday: utcDateFromYmd("2026-03-15"),
    getMidRow: midRow({ EUR: 4, USD: 4 }),
    accounts: [
      bankPln({
        transactions: [
          {
            type: "INCOME",
            amount: 5_000,
            occurredAt: utcDateFromYmd("2026-02-10"),
          },
        ],
      }),
      {
        accountType: "CRYPTO",
        currency: "USD",
        openingBalanceMinor: 10_000,
        openingEffectiveAt: utcDateFromYmd("2025-12-01"),
        transactions: [],
      },
    ],
  });

  assert.equal(result.currency, "PLN");
  assert.equal(result.monthCount, 2);
  // Jan: PLN bank opened mid-month → 100; USD crypto 100 → 400 PLN
  assert.equal(result.series[0]!.month, "2026-01");
  assert.equal(result.series[0]!.netWorth, 500);
  // Feb: PLN 150; USD 400
  assert.equal(result.series[1]!.netWorth, 550);
  assert.ok(result.ratesUsed.some((r) => r.currency === "USD"));
});

test("aggregateNetWorthHistory fails closed when a required mid is missing", async () => {
  await assert.rejects(
    () =>
      aggregateNetWorthHistory({
        currency: "PLN",
        months: ["2026-01"],
        asOfToday: utcDateFromYmd("2026-03-15"),
        getMidRow: midRow({}),
        accounts: [
          {
            accountType: "BANK",
            currency: "EUR",
            openingBalanceMinor: 100,
            openingEffectiveAt: utcDateFromYmd("2025-01-01"),
            transactions: [],
          },
        ],
      }),
    /missing mid EUR/,
  );
});
