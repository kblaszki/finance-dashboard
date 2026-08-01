---
diataxis: explanation
use_when: Understand FIFO cost basis, commissions, and who consumes realized P&L
audience: both
related_docs:
  - docs/explanation/tax-pl.md
  - docs/explanation/portfolio-stats.md
  - docs/how-to/tax-year-workflow.md
related_code:
  - backend/src/fifoRealizedPnl.ts
  - backend/src/tax/taxReport.ts
  - backend/src/tax/preSellSimulator.ts
  - backend/src/portfolioStats.ts
---

# FIFO cost basis

Hub: [docs/README.md](../README.md).

Pure FIFO matching for brokerage lots lives in `backend/src/fifoRealizedPnl.ts` (`computeFifoRealizedEvents`). Tax and portfolio layers call it; they do not reimplement queues.

## Algorithm

1. Sort lots by `tradeDate`, then `id`.
2. Maintain **per-currency** buy queues (SELL in USD never matches BUY in PLN).
3. **BUY:** enqueue quantity at unit cost = `(gross + commission) / quantity`, where `gross = totalPrice ?? quantity * pricePerUnit`.
4. **SELL:** dequeue oldest buys until quantity filled; `proceeds = gross − commission`; `gainLoss = proceeds − cost`.
5. Selling more than open quantity (or currency mismatch) throws.

## Consumers

| Consumer | Use |
|----------|-----|
| Tax report (FR-022) | Calendar-year SELL events → PIT-38; respects `settlementDate` when set ([tax-pl.md](tax-pl.md)) |
| Portfolio KPIs | Closed-position realized P&amp;L ([portfolio-stats.md](portfolio-stats.md)) |
| Pre-sell simulator (FR-050) | Hypothetical SELL against open FIFO ([tax-year-workflow.md](../how-to/tax-year-workflow.md)) |
| Position transfers | Preserve cost slices without realizing gain ([position-transfers.md](../how-to/position-transfers.md)) |

## Not TWR

Portfolio **simple return** and average holding return are separate formulas in `portfolioStats.ts` — not FIFO queues.

## Related

- [requirements.md](../reference/requirements.md) FR-022 / FR-050
- [domain.md](../reference/domain.md) HoldingLot
