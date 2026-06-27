# Tax reporting (Poland) — assumptions

Personal-use estimates for annual settlement prep. **Not tax advice.**

## What is included

- **Realized capital gains/losses** from brokerage `SELL` lots in the selected calendar year.
- **Cost basis:** FIFO (first-in, first-out), matching typical Polish securities practice.
- **Dividends:** gross sum of `DIVIDEND` transactions in the year (separate from Belka on gains).
- **Belka estimate:** 19% × max(0, net realized gains). Losses in the year reduce the taxable base; loss carryforward across years is **not** modeled.

## FX

Amounts in foreign currencies are converted using **latest NBP table A rates** from `backend/src/fx.ts`, not the rate on each sale date. For filing, compare with broker PLN statements.

## Out of scope

- IKE / IKZE tax wrappers
- PIT-38 PDF/XML, W-8BEN withholding, multi-year loss offsets
- Bond coupon taxation beyond `DIVIDEND` / `INTEREST` cash rows

## API

- `GET /api/stats/tax-report?year=&currency=`
- `GET /api/stats/tax-report/export?year=&format=csv`

See [api.md](api.md) and [domain.md](domain.md).
