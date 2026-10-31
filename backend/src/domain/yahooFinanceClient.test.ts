import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchYahooDailyHistory,
  parseYahooChartPayload,
} from "./yahooFinanceClient";
import { yahooSymbolForInstrument } from "./yahooSymbols";

test("yahooSymbolForInstrument maps indexes and GPW", () => {
  assert.equal(
    yahooSymbolForInstrument({
      symbol: "SPX",
      assetClass: "INDEX",
      exchange: "NEO",
    }),
    "^GSPC",
  );
  assert.equal(
    yahooSymbolForInstrument({
      symbol: "NDX",
      assetClass: "INDEX",
      exchange: "FSX",
    }),
    "^NDX",
  );
  assert.equal(
    yahooSymbolForInstrument({
      symbol: "PKN",
      assetClass: "STOCK",
      exchange: "GPW",
      country: "Poland",
    }),
    "PKN.WA",
  );
  assert.equal(
    yahooSymbolForInstrument({
      symbol: "AAPL",
      providerSymbol: "AAPL",
      assetClass: "STOCK",
      exchange: "NASDAQ",
    }),
    "AAPL",
  );
});

test("parseYahooChartPayload reads adjclose bars", () => {
  const bars = parseYahooChartPayload({
    chart: {
      result: [
        {
          timestamp: [1_698_624_000, 1_698_710_400],
          indicators: {
            quote: [{ close: [100, 101] }],
            adjclose: [{ adjclose: [100.5, 101.5] }],
          },
        },
      ],
    },
  });
  assert.equal(bars.length, 2);
  assert.equal(bars[0]!.close, 100.5);
  assert.equal(bars[1]!.close, 101.5);
});

test("fetchYahooDailyHistory uses chart URL", async () => {
  let seen = "";
  const bars = await fetchYahooDailyHistory("^GSPC", {
    fetchImpl: async (url) => {
      seen = String(url);
      return new Response(
        JSON.stringify({
          chart: {
            result: [
              {
                timestamp: [1_698_624_000],
                indicators: {
                  quote: [{ close: [5000] }],
                  adjclose: [{ adjclose: [5000] }],
                },
              },
            ],
          },
        }),
        { status: 200 },
      );
    },
  });
  assert.match(seen, /chart\/%5EGSPC|chart\/\^GSPC/);
  assert.equal(bars.length, 1);
  assert.equal(bars[0]!.close, 5000);
});
