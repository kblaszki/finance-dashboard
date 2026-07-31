---
diataxis: how-to
use_when: Configure account sync stubs or PSD2 bank connection stubs
audience: both
related_docs:
  - docs/reference/api.md
  - docs/how-to/market-data-sync.md
related_code:
  - backend/src/accountSync.ts
  - backend/src/bankConnections.ts
---

# Account sync and bank connections

Hub: [docs/README.md](../README.md).

These are **stubs** (FR-035 / FR-036) with real settings persistence. Brokerage/crypto “run” may call market price sync; bank authorize does not pull live PSD2 data.

## Account sync settings

1. UI: `/settings` automation section.
2. List: `GET /api/account-sync`.
3. Upsert: `PUT /api/account-sync/:accountId` — `{ provider?, syncEnabled?, syncIntervalHours?, configJson? }` (`provider`: `stub` \| `broker_api` \| `bank_api`).
4. Run: `POST /api/account-sync/:accountId/run` — brokerage/crypto → market prices path; bank → stub status update.

## Bank connections (PSD2 stub)

1. BANK accounts only.
2. `POST /api/bank-connections` — `{ accountId, bankCode }`.
3. `POST /api/bank-connections/:id/authorize` — stub OAuth consent (`status` → `connected`).
4. List/delete: `GET/DELETE /api/bank-connections`.
5. Statuses: `pending` \| `connected` \| `error` (optional `consentExpiresAt`, `errorMessage`).

For real EOD prices, use [market-data-sync.md](market-data-sync.md) directly.
