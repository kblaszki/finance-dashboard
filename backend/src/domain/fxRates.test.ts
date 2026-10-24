import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { convertMajor, utcDateFromYmd } from "./fx";
import {
  defaultSyncRange,
  getMidOnOrBefore,
  syncFxRates,
  upsertFxRates,
} from "./fxRates";
import type { NbpFetch } from "./nbpClient";
import {
  createTestPrisma,
  disconnectTestPrisma,
  resetDatabase,
} from "../../test/prismaTestClient";

test("defaultSyncRange spans N inclusive UTC days", () => {
  const { fromYmd, toYmd } = defaultSyncRange(1);
  assert.equal(fromYmd, toYmd);
  const span = defaultSyncRange(7);
  const from = utcDateFromYmd(span.fromYmd);
  const to = utcDateFromYmd(span.toYmd);
  assert.equal((to.getTime() - from.getTime()) / 86_400_000, 6);
});

test("upsert getMidOnOrBefore and convert with weekend as-of", async () => {
  const prisma = await createTestPrisma();
  try {
    await resetDatabase(prisma);
    const friday = utcDateFromYmd("2026-01-09");
    await upsertFxRates(prisma, [
      { currency: "EUR", rateDate: friday, mid: 4.2 },
      { currency: "USD", rateDate: friday, mid: 4.0 },
    ]);

    const sunday = utcDateFromYmd("2026-01-11");
    const mid = await getMidOnOrBefore(prisma, "EUR", sunday);
    assert.equal(mid.toNumber(), 4.2);

    const converted = await convertMajor({
      amount: 42,
      from: "EUR",
      to: "PLN",
      asOf: sunday,
      getMid: (c, asOf) => getMidOnOrBefore(prisma, c, asOf),
    });
    assert.equal(converted, 176.4);

    await assert.rejects(
      () => getMidOnOrBefore(prisma, "EUR", utcDateFromYmd("2020-01-01")),
      /No NBP FX rate/,
    );
  } finally {
    await disconnectTestPrisma(prisma);
  }
});

test("syncFxRates upserts from mocked NBP fetch", async () => {
  const prisma = await createTestPrisma();
  try {
    await resetDatabase(prisma);
    const fetchImpl: NbpFetch = async (url) => {
      if (url.includes("/EUR/")) {
        return new Response(
          JSON.stringify({
            code: "EUR",
            rates: [{ effectiveDate: "2026-02-02", mid: 4.25 }],
          }),
          { status: 200 },
        );
      }
      if (url.includes("/USD/")) {
        return new Response(
          JSON.stringify({
            code: "USD",
            rates: [{ effectiveDate: "2026-02-02", mid: 3.95 }],
          }),
          { status: 200 },
        );
      }
      return new Response(null, { status: 404 });
    };

    const result = await syncFxRates(prisma, {
      fromYmd: "2026-02-02",
      toYmd: "2026-02-02",
      fetchImpl,
    });
    assert.equal(result.upserted, 2);

    const eur = await getMidOnOrBefore(
      prisma,
      "EUR",
      utcDateFromYmd("2026-02-02"),
    );
    assert.ok(eur instanceof Prisma.Decimal);
    assert.equal(eur.toNumber(), 4.25);
  } finally {
    await disconnectTestPrisma(prisma);
  }
});
