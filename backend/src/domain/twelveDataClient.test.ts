import assert from "node:assert/strict";
import { test } from "node:test";
import {
  fetchTwelveDataEodQuote,
  fetchTwelveDataEtfs,
  fetchTwelveDataStocks,
} from "./twelveDataClient";

test("fetchTwelveDataStocks maps catalog payload", async () => {
  const fetchImpl = async () =>
    new Response(
      JSON.stringify({
        data: [
          {
            symbol: "AAPL",
            name: "Apple Inc",
            exchange: "NASDAQ",
            mic_code: "XNAS",
            country: "United States",
            currency: "USD",
          },
        ],
      }),
      { status: 200 },
    );
  const rows = await fetchTwelveDataStocks(fetchImpl, "test-key");
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.symbol, "AAPL");
  assert.equal(rows[0]!.micCode, "XNAS");
});

test("fetchTwelveDataEtfs maps catalog payload", async () => {
  const fetchImpl = async () =>
    new Response(
      JSON.stringify({
        data: [{ symbol: "VOO", name: "Vanguard S&P 500", exchange: "NYSE", currency: "USD" }],
      }),
      { status: 200 },
    );
  const rows = await fetchTwelveDataEtfs(fetchImpl, "test-key");
  assert.equal(rows[0]!.symbol, "VOO");
});

test("fetchTwelveDataEodQuote parses close and date", async () => {
  const fetchImpl = async () =>
    new Response(
      JSON.stringify({
        symbol: "AAPL",
        close: "190.12",
        datetime: "2026-10-29 16:00:00",
        currency: "USD",
      }),
      { status: 200 },
    );
  const quote = await fetchTwelveDataEodQuote("AAPL", fetchImpl, "test-key");
  assert.equal(quote.close, 190.12);
  assert.equal(quote.asOfYmd, "2026-10-29");
  assert.equal(quote.currency, "USD");
});
