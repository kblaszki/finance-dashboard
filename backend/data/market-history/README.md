# Market history files

| File | In git? | Purpose |
|------|---------|---------|
| `demo-eod.ndjson` | Yes | Sparse demo fixture (~5 tickers, ~1y, 1 close/month) |
| `exports/allowlist-eod.ndjson.gz` | No | Default full allowlist dump (`market:export-history`) |

`db:seed` Markets path: if `exports/allowlist-eod.ndjson.gz` exists → import that (valuations for all symbols in file; demo watchlist stays the 5 curated favorites). Else → `demo-eod.ndjson`.

## Export all allowlist valuations

```bash
cd backend && npm run build
# optional: collect prices first
# npm run market:sync-history-yahoo -- --force --range=10y
npm run market:export-history
# → data/market-history/exports/allowlist-eod.ndjson.gz
```

Custom path:

```bash
npm run market:export-history -- --out=data/market-history/exports/my-dump.ndjson.gz
```

## Import

```bash
npm run market:import-history
# or --file=data/market-history/exports/allowlist-eod.ndjson.gz
```

## Sparse fixture for commit

```bash
npm run market:export-history -- --months=12 --monthly --out=data/market-history/demo-eod.ndjson
# trim to AAPL VOO SPX XTB ETFBW20TR if needed, then commit demo-eod.ndjson only
```
