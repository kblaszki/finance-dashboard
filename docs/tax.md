# Tax reporting (Poland) — assumptions

Personal-use estimates for annual settlement prep. **Not tax advice.**

## What is included

- **Realized capital gains/losses** from brokerage `SELL` lots in the selected calendar year (PIT-38 helper, FR-022).
- **Cost basis:** FIFO with **commission** included in buy cost and net sell proceeds.
- **Dividends:** `IncomeEvent` rows (`eventType=dividend`) when present; otherwise `DIVIDEND` transactions (FR-024).
- **Belka on interest:** `IncomeEvent` with `tax_type=belka` or interest/coupon events (FR-027); falls back to `INTEREST` transactions when no income events exist.
- **PIT/ZG helper:** foreign income aggregated by `sourceCountry` / `Instrument.pitZgCountry` (FR-028).
- **Belka on gains:** 19% × max(0, net realized gains). Loss carryforward across years is **not** modeled.

## Out of scope

- IKE / IKZE / PPK tax wrappers (FR-039, Phase E)
- Rental PIT-36 amounts until real estate accounts (FR-030, Phase C) — stub section only
- PIT-38 PDF/XML, W-8BEN withholding reconciliation, multi-year loss offsets
- Bond coupon taxation beyond `IncomeEvent` / `INTEREST` / `DIVIDEND` cash rows
- Historical NBP rate per settlement date (uses latest NBP table; see FX below)

## FX

Amounts in foreign currencies are converted using **latest NBP table A rates** from `backend/src/fx.ts`, not the rate on each sale date. For filing, compare with broker PLN statements.

## API

- `GET /api/stats/tax-report?year=&currency=`
- `GET /api/stats/tax-report/export?year=&format=csv`

See [api.md](api.md) and [domain.md](domain.md).
