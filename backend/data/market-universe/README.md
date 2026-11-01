# Market universe (allowlist seed)

JSON files consumed by `npm run market:seed-universe` (after `npm run build`).

| File | Contents |
|------|----------|
| `sp500.json` | S&P 500 constituents (refresh periodically from public constituents CSV) |
| `gpw-wig20-mwig40.json` | GPW WIG20 + mWIG40-style large/mid caps |
| `indices.json` | Benchmark indexes (and ACWI ETF proxy) |
| `etfs.json` | Curated iShares / Vanguard / Beta PL ETFs |

Each row: `symbol`, `name`, `assetClass` (`STOCK`\|`ETF`\|`INDEX`), optional `exchange`, `country`, `currency`, `providerSymbol`, optional `historySource` (`yahoo` — default when omitted, e.g. `sp500.json`).

Valuations use **Yahoo** (`market:sync-history-yahoo` / `market:sync-quotes`) or a local export dump — not Twelve Data / Stooq from these seed files. Legacy `stooqSymbol` / `historySource: stooq|twelve_data` are unused if present.
