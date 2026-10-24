import test from "node:test";
import assert from "node:assert/strict";
import { fetchNbpRatesForCurrency, NBP_MAX_RANGE_DAYS } from "./nbpClient";
import type { NbpFetch } from "./nbpClient";

test("fetchNbpRatesForCurrency returns empty on 404", async () => {
  const fetchImpl: NbpFetch = async () => new Response(null, { status: 404 });
  const rows = await fetchNbpRatesForCurrency(
    "EUR",
    "2026-01-01",
    "2026-01-02",
    fetchImpl,
  );
  assert.deepEqual(rows, []);
});

test("fetchNbpRatesForCurrency parses mids", async () => {
  const fetchImpl: NbpFetch = async () =>
    new Response(
      JSON.stringify({
        code: "USD",
        rates: [
          { effectiveDate: "2026-01-05", mid: 3.9 },
          { effectiveDate: "2026-01-06", mid: 3.91 },
        ],
      }),
      { status: 200 },
    );
  const rows = await fetchNbpRatesForCurrency(
    "USD",
    "2026-01-05",
    "2026-01-06",
    fetchImpl,
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.currency, "USD");
  assert.equal(rows[0]!.mid.toNumber(), 3.9);
});

test("NBP_MAX_RANGE_DAYS is 367", () => {
  assert.equal(NBP_MAX_RANGE_DAYS, 367);
});
