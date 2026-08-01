---
diataxis: how-to
use_when: Close or review a Polish tax year in the app
audience: both
related_docs:
  - docs/explanation/tax-pl.md
  - docs/reference/api.md
  - docs/reference/frontend.md
related_code:
  - backend/src/tax/
  - frontend/src/features/tax/
---

# Tax year workflow (Poland)

Hub: [docs/README.md](../README.md).

Personal-use helpers for annual settlement prep — **not tax advice**. Assumptions: [tax-pl.md](../explanation/tax-pl.md).

Use this order when reviewing or closing a calendar year `Y`.

## 1. Prerequisites (settings)

1. Open `/tax/settings` (`TaxSettingsPage`).
2. Set brokerage `taxWrapperType` (`standard` / `ike` / `ikze` / `ppk`) on accounts as needed.
3. Record IKZE contributions (`/api/ikze-contributions`) and tax-wrapper withdrawals (`/api/tax-wrapper-withdrawals`) when relevant.
4. Maintain loss carryforward register (`GET/PUT/DELETE /api/tax-loss-carryforward`) for prior-year losses (FR-042).
5. Ensure lots have `settlementDate` where it matters for year assignment (falls back to `tradeDate`).

## 2. Year report

1. Open `/tax/:year` with `year=Y` (`TaxReportPage`) — or `GET /api/stats/tax-report?year=Y&currency=`.
2. Review FIFO sales, Belka / dividend sections, PIT/ZG helper, rental stub as applicable.
3. Export sales CSV: `GET /api/stats/tax-report/export?year=Y&format=csv` (crypto PIT export via `reportType=crypto_pit` — see Stats / Tax completeness in [api.md](../reference/api.md)).

## 3. Overview, pre-sell, and attachments

1. `/tax/:year/overview` — consolidated summary (`GET /api/stats/tax-overview?year=Y`, optional `snapshot=1`). Reachable from tax report links (not in sidebar).
2. **Pre-sell simulator (FR-050):** on holding detail (`PreSellSimulatorForm`) or `POST /api/stats/pre-sell-simulator` — estimated FIFO gain before a sale ([fifo-cost-basis.md](../explanation/fifo-cost-basis.md)).
3. **Document attachments (FR-049):** `/settings` → metadata only (entity type/id, filename) — no binary upload; `GET/POST/DELETE /api/document-attachments`.

## 4. Calendar and checklist

1. `/tax/calendar` — deadlines + checklist (`GET /api/tax-calendar?year=Y`).
2. Mark items: `PUT /api/tax-checklist` with `{ taxYear, itemKey, completed }`.

## 5. Supporting registers (as needed)

| Topic | UI / API |
|-------|----------|
| Property sales | `GET/POST/DELETE /api/property-sales` |
| Document attachments (metadata) | `GET/POST/DELETE /api/document-attachments` |
| Wrapper withdrawals / IKZE | Tax settings + wrapper APIs above |

## Code map

| Area | Path |
|------|------|
| Domain | `backend/src/tax/*` |
| HTTP | `statsRoutes` tax-report/overview, `taxLossCarryforwardRoutes`, `taxCalendarRoutes`, `taxWrappersRoutes`, property/document routes |
| UI | `frontend/src/features/tax/` |
| Clients | `taxReportApi`, `taxOverviewApi`, `taxLossCarryforwardApi`, `taxCalendarApi`, `taxWrappersApi`, … |
