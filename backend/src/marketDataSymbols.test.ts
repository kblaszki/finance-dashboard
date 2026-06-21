import test from "node:test";
import assert from "node:assert/strict";
import { mapInstrumentToProviderSymbol, isSyncableInstrumentType } from "./marketDataSymbols";

test("isSyncableInstrumentType allows STOCK and ETF only", () => {
  assert.equal(isSyncableInstrumentType("STOCK"), true);
  assert.equal(isSyncableInstrumentType("etf"), true);
  assert.equal(isSyncableInstrumentType("BOND"), false);
  assert.equal(isSyncableInstrumentType("FUND"), false);
});

test("mapInstrumentToProviderSymbol maps US exchanges to bare symbol", () => {
  assert.equal(
    mapInstrumentToProviderSymbol({ symbol: "aapl", exchange: "NASDAQ", instrumentType: "STOCK" }),
    "AAPL",
  );
  assert.equal(
    mapInstrumentToProviderSymbol({ symbol: "VT", exchange: "NYSE", instrumentType: "ETF" }),
    "VT",
  );
});

test("mapInstrumentToProviderSymbol maps GPW to WAR suffix", () => {
  assert.equal(
    mapInstrumentToProviderSymbol({ symbol: "pko", exchange: "GPW", instrumentType: "STOCK" }),
    "PKO:WAR",
  );
});

test("mapInstrumentToProviderSymbol maps XETRA and LSE", () => {
  assert.equal(
    mapInstrumentToProviderSymbol({ symbol: "IWDA", exchange: "XETRA", instrumentType: "ETF" }),
    "IWDA:XETR",
  );
  assert.equal(
    mapInstrumentToProviderSymbol({ symbol: "VUSA", exchange: "LSE", instrumentType: "ETF" }),
    "VUSA:LSE",
  );
});

test("mapInstrumentToProviderSymbol returns null for bonds and unknown exchanges", () => {
  assert.equal(
    mapInstrumentToProviderSymbol({ symbol: "EDO", exchange: null, instrumentType: "BOND" }),
    null,
  );
  assert.equal(
    mapInstrumentToProviderSymbol({ symbol: "FOO", exchange: "UNKNOWN", instrumentType: "STOCK" }),
    null,
  );
});
