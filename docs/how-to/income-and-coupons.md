---
diataxis: how-to
use_when: Record dividends, interest, coupons, or coupon schedules
audience: both
related_docs:
  - docs/reference/domain.md
  - docs/explanation/tax-pl.md
related_code:
  - backend/src/incomeEvents.ts
  - backend/src/couponSchedules.ts
---

# Income events and coupons

Hub: [docs/README.md](../README.md).

Prefer `IncomeEvent` rows for tax reporting over duplicate cash `DIVIDEND` / `INTEREST` transactions when both exist.

## Income events

1. UI: `/income-events`.
2. List: `GET /api/income-events` — optional `from`, `to`, `accountId`.
3. Create: `POST /api/income-events` — `{ accountId, eventType, amount, currency, date, taxType?, instrumentId?, withheldTax?, sourceCountry?, foreignTaxPaid?, description? }`.
4. `eventType`: `dividend` \| `interest` \| `coupon` \| `capital_gain_distribution`.
5. `taxType`: `belka` \| `pit38` \| `exempt` (optional).
6. Update/delete: `PUT/DELETE /api/income-events/:id`.

## Coupon schedules

1. Same page section (`CouponSchedulesSection`) or API.
2. Create planned payment on a BOND/ETF holding: `POST /api/coupon-schedules` — `{ accountId, instrumentId, scheduleType, amount, currency, date, description? }` (`coupon` \| `amortization`).
3. When paid: `POST /api/coupon-schedules/:id/record-income` — creates linked `IncomeEvent` and marks recorded.
4. Delete unrecorded: `DELETE /api/coupon-schedules/:id`.

Tax context: [tax-pl.md](../explanation/tax-pl.md); enums: [domain.md](../reference/domain.md#domain-enums-code-constants).

| Area | Path |
|------|------|
| Domain | `incomeEvents.ts`, `couponSchedules.ts` |
| Clients | `incomeEventsApi.ts`, `couponSchedulesApi.ts` |
| UI | `IncomeEventsPage` |
