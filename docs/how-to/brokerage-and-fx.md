---
diataxis: how-to
use_when: Work on brokerage positions or FX conversion
audience: agent
related_docs:
  - docs/explanation/architecture.md
  - docs/reference/domain.md
related_code:
  - backend/src/fx.ts
  - backend/src/holdingLot.ts
---

# Brokerage and FX work

Hub: [docs/README.md](../README.md).

- Positions: `HoldingLot` on `Account` (`BROKERAGE`); charts from `AccountValuationDaily` / `HoldingValuationDaily`.
- FX: implement conversion only in `backend/src/fx.ts` — never reimplement in route handlers or UI.
- Holdings helpers: `backend/src/holdingLot.ts`, `backend/src/holdings.ts`.
- See [docs/meta/code-map.md](../meta/code-map.md) rows for Holdings / FX / Valuations.
- Market EOD sync: [docs/explanation/architecture.md](../explanation/architecture.md) (Market data section).
