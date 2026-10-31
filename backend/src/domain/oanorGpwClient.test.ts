import assert from "node:assert/strict";
import { test } from "node:test";
import {
  fetchOanorGpwQuotes,
  OANOR_GPW_QUOTE_BATCH_SIZE,
} from "./oanorGpwClient";

test("fetchOanorGpwQuotes maps batch payload and sends x-oanor-key", async () => {
  let seenUrl = "";
  let seenKey = "";
  const fetchImpl = async (url: string, init?: RequestInit) => {
    seenUrl = url;
    const headers = init?.headers as Record<string, string> | undefined;
    seenKey = headers?.["x-oanor-key"] ?? "";
    return new Response(
      JSON.stringify({
        success: true,
        status: "ok",
        data: {
          quotes: [
            {
              ticker: "ETFBW20TR",
              price: 53.45,
              currency: "PLN",
            },
            { ticker: "PKN", price: 146.84, currency: "PLN" },
          ],
        },
        meta: { timestamp: "2026-10-30T15:00:00.000Z" },
      }),
      { status: 200 },
    );
  };

  const quotes = await fetchOanorGpwQuotes(
    ["etfbw20tr", "PKN", "PKN"],
    fetchImpl,
    "test-oanor-key",
  );
  assert.equal(quotes.length, 2);
  assert.equal(quotes[0]!.symbol, "ETFBW20TR");
  assert.equal(quotes[0]!.close, 53.45);
  assert.equal(quotes[0]!.asOfYmd, "2026-10-30");
  assert.equal(quotes[0]!.currency, "PLN");
  assert.equal(seenKey, "test-oanor-key");
  assert.match(seenUrl, /codes=ETFBW20TR%2CPKN|codes=ETFBW20TR,PKN/);
});

test("fetchOanorGpwQuotes rejects oversized batch", async () => {
  const codes = Array.from({ length: OANOR_GPW_QUOTE_BATCH_SIZE + 1 }, (_, i) =>
    `T${i}`,
  );
  await assert.rejects(
    () => fetchOanorGpwQuotes(codes, async () => new Response(""), "k"),
    /batch max/,
  );
});

test("fetchOanorGpwQuotes maps 429 to actionable error", async () => {
  await assert.rejects(
    () =>
      fetchOanorGpwQuotes(
        ["PKN"],
        async () => new Response("", { status: 429 }),
        "k",
      ),
    /rate limit|quota/i,
  );
});

test("fetchOanorGpwQuotes omits quotes with unusable price", async () => {
  const fetchImpl = async () =>
    new Response(
      JSON.stringify({
        success: true,
        status: "ok",
        data: {
          quotes: [
            { ticker: "OK", price: 10, currency: "PLN" },
            { ticker: "BAD", price: 0, currency: "PLN" },
          ],
        },
        meta: { timestamp: "2026-10-30T12:00:00.000Z" },
      }),
      { status: 200 },
    );
  const quotes = await fetchOanorGpwQuotes(["OK", "BAD"], fetchImpl, "k");
  assert.equal(quotes.length, 1);
  assert.equal(quotes[0]!.symbol, "OK");
});
