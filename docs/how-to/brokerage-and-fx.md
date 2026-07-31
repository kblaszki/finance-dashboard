---
diataxis: how-to
use_when: Work on brokerage positions or FX conversion
audience: agent
related_docs:
  - docs/explanation/architecture.md
  - docs/reference/domain.md
  - docs/how-to/accounts-and-holdings.md
  - docs/how-to/market-data-sync.md
related_code:
  - backend/src/fx.ts
  - backend/src/holdingLot.ts
---

# Brokerage and FX work

Hub: [docs/README.md](../README.md).

- Positions: `HoldingLot` on holdings-capable accounts (`BROKERAGE`, `CRYPTO`, `PRECIOUS_METAL`); charts from `AccountValuationDaily` / `HoldingValuationDaily`.
- FX: implement conversion only in `backend/src/fx.ts` — never reimplement in route handlers or UI.
- Holdings helpers: `backend/src/holdingLot.ts`, `backend/src/holdings.ts`.
- Day-to-day UI/API recipe: [accounts-and-holdings.md](accounts-and-holdings.md).
- Market EOD sync ops: [market-data-sync.md](market-data-sync.md); architecture: [architecture.md](../explanation/architecture.md) (Market data section).
- Code map: [docs/meta/code-map.md](../meta/code-map.md) rows for Holdings / FX / Valuations / Market data.
