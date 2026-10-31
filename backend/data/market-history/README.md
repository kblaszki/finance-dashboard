# Market history files

| File | In git? | Purpose |
|------|---------|---------|
| `demo-eod.ndjson` | Yes | Sparse demo fixture (~5 tickers, ~1y, 1 close/month) loaded by `db:seed` |
| `allowlist-eod.ndjson.gz` | No (gitignore) | Full allowlist dump after `market:export-history` |

## Collect ~10y allowlist (local)

```bash
cd backend && npm run build
npm run market:sync-history-yahoo -- --force --range=10y
npm run market:export-history
# → data/market-history/allowlist-eod.ndjson.gz
npm run market:import-history   # restore on another DB
```

## Refresh demo fixture

```bash
# After Yahoo 1y (or more) exists in DB for AAPL VOO SPX XTB ETFBW20TR:
npm run market:export-history -- --months=12 --monthly --out=data/market-history/demo-eod.ndjson
# Then trim to the five demo symbols if the export was allowlist-wide, or export
# per instrumentId. Commit only demo-eod.ndjson.
```
