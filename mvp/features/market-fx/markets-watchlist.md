---
id: FR-039
status: done
domain: market-fx
title: Markets watchlist
---

# Markets watchlist

## Summary

Authenticated `/markets` page: search local `Instrument` catalog, add/remove favorites (`WatchlistItem`), show last close from DB.

## Surfaces

| Kind | Location |
|------|----------|
| API | `GET /api/instruments`, `GET|POST|DELETE /api/watchlist` |
| UI | `frontend/src/pages/MarketsPage.tsx`, nav **Markets** |
| Clients | `instrumentsApi.ts`, `watchlistApi.ts` |

## Acceptance

- [x] Local search with min `q` and soft limit
- [x] Per-user watchlist with IDOR → 404
- [x] Missing price shown without blocking favorite

## Related

- [MVP-021](stock-etf-market-sync.md) catalog/quote sync
- [docs/how-to/markets-watchlist.md](../../../docs/how-to/markets-watchlist.md)
