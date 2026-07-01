# Tax reporting (Poland) — assumptions

Personal-use estimates for annual settlement prep. **Not tax advice.**

## What is included

- **Realized capital gains/losses** from brokerage `SELL` lots in the selected calendar year (PIT-38 helper, FR-022).
- **Cost basis:** FIFO with **commission** included in buy cost and net sell proceeds; `settlementDate` on lots when set (FR-039 prerequisites).
- **Loss carryforward:** `TaxLossCarryforward` register applied oldest-first against net gains (FR-042).
- **IKE / IKZE / PPK:** `Account.taxWrapperType` and wrapper withdrawals; holdings excluded from PIT-38 unless withdrawn with `includeInPit38` (FR-039).
- **Dividends:** `IncomeEvent` rows (`eventType=dividend`) when present; otherwise `DIVIDEND` transactions (FR-024).
- **Belka on interest/coupons:** `IncomeEvent` with `taxType=belka` or interest/coupon events (FR-027); falls back to `INTEREST` transactions when no income events exist.
- **PIT/ZG helper:** foreign income aggregated by `sourceCountry` / `Instrument.pitZgCountry` (FR-028).
- **Rental PIT-36 section:** `PropertyCashFlow` on `REAL_ESTATE` accounts (FR-030).
- **Crypto PIT scale section:** separate from PIT-38 on tax overview / export when configured (FR-043).
- **Property sales, calendar, overview, snapshots, attachments, pre-sell simulator** — see [api.md](api.md) tax routes (FR-044–050).

## Out of scope

- Official PIT-38 / PIT-36 PDF/XML or e-Urząd Skarbowy submission
- W-8BEN withholding reconciliation, employment income (PIT-11), JDG/VAT
- Historical NBP rate per settlement date in all paths (many amounts use latest NBP table A; see FX below)
- Bond coupon taxation beyond `IncomeEvent`, scheduled coupons, and cash `INTEREST` rows

## FX

Amounts in foreign currencies are converted using **latest NBP table A rates** from `backend/src/fx.ts` unless a route documents historical lookup (e.g. tax lot settlement). For filing, compare with broker PLN statements.

## API

- `GET /api/stats/tax-report?year=&currency=`
- `GET /api/stats/tax-report/export?year=&format=csv`
- `GET /api/tax/:year/overview`, `/api/tax-calendar`, loss carryforward, property sales, etc.

See [api.md](api.md) and [domain.md](domain.md).
