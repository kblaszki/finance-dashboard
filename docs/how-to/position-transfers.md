---
diataxis: how-to
use_when: Move securities between brokerage accounts without a taxable sale
audience: both
related_docs:
  - docs/how-to/internal-transfers.md
  - docs/reference/domain.md
related_code:
  - backend/src/positionTransfers.ts
  - backend/src/routes/positionTransfersRoutes.ts
---

# Position transfers

Hub: [docs/README.md](../README.md).

Move open **BUY** lot quantity between two brokerage accounts while preserving FIFO cost basis. Not a cash transfer — see [internal-transfers.md](internal-transfers.md) for cash legs.

## Constraints

- Both accounts must be `accountType === BROKERAGE` and owned by the user.
- Quantity cannot exceed open (unmatched) buy quantity on the source holding.
- Destination holding is created if missing; valuations recompute from `transferDate`.

## Steps

1. UI: `/tax/settings` — position transfer form — or API.
2. Create: `POST /api/position-transfers` — `{ fromAccountId, toAccountId, instrumentId, quantity, transferDate }`.
3. List: `GET /api/position-transfers` — optional `accountId`, `from`, `to`.

| Area | Path |
|------|------|
| Domain | `backend/src/positionTransfers.ts` |
| HTTP | `positionTransfersRoutes.ts` |
| Client | `positionTransfersApi.ts` |
