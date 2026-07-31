---
diataxis: reference
use_when: Prisma models and domain relationships
audience: both
related_docs:
  - docs/reference/api.md
related_code:
  - backend/prisma/schema.prisma
---
# Domain model

Source of truth: [`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma).

## Core entities

| Model | Purpose |
|-------|---------|
| `User` | `email`, `username`, `passwordHash` |
| `Account` | Unified account (`BANK`, `BROKERAGE`, `CRYPTO`, `PRECIOUS_METAL`, `REAL_ESTATE`, `OTHER`, legacy `MANUAL`); `cashBalance`, `openingBalance`, `openingCashAsOf` (DATA-002), `metalGrams` (PRECIOUS_METAL), `taxWrapperType` (BROKERAGE: `standard`, `ike`, `ikze`, `ppk`), `rentalTaxMethod` (REAL_ESTATE: `scale`, `lump_sum_8_5`), `currency` |
| `Transaction` | Cash flows with `balanceAfter` snapshot; `transactionType` values in Domain enums below |
| `Instrument` | Global instrument catalog (symbol, exchange, type, `source` default `manual`; unique on `(symbol, exchange, source)`) |
| `Holding` | Brokerage position per account + instrument; persisted `quantity` (current net shares) |
| `HoldingLot` | BUY/SELL trade ledger under a `Holding` (`side`); `quantityAfter` chain; `commission` (FR-007); optional `settlementDate` |
| `InstrumentValuation` | Daily/manual price per instrument |
| `FxRateDaily` | Historical NBP FX legs (USD/PLN, EUR/PLN) since 2020 (FR-010, DATA-008) |
| `AccountValuationDaily` | Materialized account value snapshots |
| `HoldingValuationDaily` | Materialized position value per instrument |

## Brokerage holdings

- One `Holding` row per `(accountId, instrumentId)`; created on first trade.
- `Holding.quantity` is synced from the last lot's `quantityAfter` after every lot CRUD.
- Closed positions (`quantity = 0`) are retained for history and realized P&amp;L.
- `marketValue` and `realizedPnl` are computed at read time (not stored on `Holding`). Closed-position `realizedPnl` uses **FIFO** across lots (`fifoRealizedPnl.ts`).

## Instrument types

Allowed `Instrument.instrumentType` values: `STOCK`, `ETF`, `BOND`, `FUND`, `OTHER`.

| Type | Typical valuation source |
|------|-------------------------|
| STOCK, ETF | `twelve_data` (EOD sync) when exchange is mapped; else manual |
| Crypto | Holdings on `Account.accountType === CRYPTO` (pair symbols e.g. `BTC/USD`); not a separate `instrumentType` value |
| BOND, FUND | Manual NAV/price via `InstrumentValuation` with `source: "manual"` (free-string; not a fixed `manual_nav` enum) |
| OTHER | `source: "manual"` |

Market sync (`POST /api/market-data/sync`) processes **STOCK**, **ETF**, and holdings on **CRYPTO** accounts; BOND/FUND are skipped without error.

## Global instrument catalog

- `Instrument` and `InstrumentValuation` rows are **shared** across all users (no `userId` on the model).
- `Instrument.source` defaults to `"manual"` (catalog provenance; market sync may write valuations with `source: twelve_data`).
- Any authenticated user may search/create instruments and append manual valuations.
- `POST /api/instruments/:id/valuations` writes a global price row but **recomputes daily account snapshots only for the caller's accounts** that hold the instrument (`recomputeAccountsForInstrumentUser`).
- `POST /api/market-data/sync` still recomputes all affected accounts (system job).
- Designed for **single-user private** deployment; multi-tenant hosting requires a product decision (per-user catalog, admin-only writes, etc.). See [private-deploy.md](../how-to/private-deploy.md).

## CSV import

- **Runtime HTTP import:** broker = `xtb` only (`POST /api/import/broker-trades`); bank = `mbank` \| `generic` (`POST /api/import/bank-transactions`).
- Parsed broker rows become `HoldingLot` (trades) or `Transaction` (dividends, interest, transfers). Bank rows become `Transaction`s.
- `ImportBatch` / `ImportRow` store `externalHash` per account for idempotent re-upload; applied rows may link `holdingLotId` or `transactionId`.
- **`ImportPreset`:** built-in templates (e.g. xtb, mbank, ibkr, revolut, binance) plus user-saved column maps — templates for the presets UI; only the runtime brokers/banks above are wired to import endpoints. See [import-csv.md](../how-to/import-csv.md).

## Corporate actions

| Event | Mechanism |
|-------|-----------|
| Dividend | `Transaction` type `DIVIDEND` credits brokerage cash (`category` typically `DIVIDEND`); or `IncomeEvent` `eventType=dividend` |
| Bond interest | `Transaction` type `INTEREST` on bank or brokerage; or `IncomeEvent` `interest` / `coupon` |
| Stock / reverse split | `POST /api/holdings/:holdingId/split` or `CorporateAction` `stock_split` / `reverse_split` — multiplies lot quantities and `quantityAfter` by ratio; `pricePerUnit` divides; `totalPrice` unchanged |
| Merger / spinoff | `CorporateAction` audit row only — **no** lot mutation |

Splits recompute account valuations from `effectiveDate` / `actionDate`. Historical charts before the split may show pre-split per-share prices with post-split quantities unless market prices are adjusted manually.

## Tax reporting (PL)

Annual estimates via `GET /api/stats/tax-report` — FIFO realized gains on SELL lots in calendar year, dividend gross, Belka 19% on positive net gains. Details: [tax-pl.md](../explanation/tax-pl.md).

## Account workflow

Capability sets from [`backend/src/accountTypes.ts`](../../backend/src/accountTypes.ts) and [`assetValuations.ts`](../../backend/src/assetValuations.ts):

| Account type | Cash ledger | Holdings / lots | Manual revalue | Asset valuations | Notes |
|--------------|-------------|-----------------|----------------|------------------|-------|
| `BANK` | Yes | No | No | No | Bank CSV import; PSD2 stub |
| `BROKERAGE` | Yes | Yes | No | No | Trades, tax wrappers, XTB import, market EOD |
| `CRYPTO` | Yes | Yes | No | No | Pair symbols (e.g. `BTC/USD`); market sync |
| `PRECIOUS_METAL` | Yes | Yes | No | Yes | Optional `metalGrams`; holdings and/or asset NAV |
| `REAL_ESTATE` | No cash txs in holdings sense | No | Yes | Yes | `PropertyCashFlow`, `PropertySale`, `rentalTaxMethod` |
| `OTHER` | Via revalue path | No | Yes | Yes | Same revalue set as MANUAL |
| `MANUAL` (legacy) | Via revalue path | No | Yes | Yes | Alias of OTHER for existing rows |

- **BANK** — transactions update `cashBalance` and `balanceAfter`; valuations backfilled for charts.
- **BROKERAGE / CRYPTO / PRECIOUS_METAL** — holdings via `Holding` / `HoldingLot` where applicable; brokerage cash replays transactions **and** lot trade cash impact (BUY/SELL).
- **MANUAL / REAL_ESTATE / OTHER** — revalue via `POST /api/accounts/:id/revalue` (`INCOME`/`EXPENSE` + `category: "REVALUATION"`) or `AssetValuation` rows.

## Domain enums (code constants)

Values live in TypeScript modules (not Prisma enums). Source modules under `backend/src/`.

| Concern | Values | Module |
|---------|--------|--------|
| `Transaction.transactionType` | `INCOME`, `EXPENSE`, `TRANSFER_IN`, `TRANSFER_OUT`, `DIVIDEND`, `INTEREST` | `transactionBalance.ts` |
| `HoldingLot.side` | `BUY`, `SELL` | `holdingLot.ts` |
| `Instrument.instrumentType` | `STOCK`, `ETF`, `BOND`, `FUND`, `OTHER` | `instrumentTypes.ts` |
| `IncomeEvent.eventType` | `dividend`, `interest`, `coupon`, `capital_gain_distribution` | `incomeEvents.ts` |
| `IncomeEvent.taxType` | `belka`, `pit38`, `exempt` | `incomeEvents.ts` |
| `Liability.liabilityType` | `mortgage`, `loan`, `credit`, `tax_provision`, `tax_advance` | `liabilities.ts` |
| `PropertyCashFlow.flowType` | `rent`, `maintenance`, `other` | `propertyCashFlows.ts` |
| `CouponSchedule.scheduleType` | `coupon`, `amortization` | `couponSchedules.ts` |
| `CategorizationRule.matchType` | `contains`, `regex` (+ `priority`, `active`) | `categorizationRules.ts` |
| `TaxWrapperWithdrawal.withdrawalType` | `partial`, `full`, `securities_transfer` | `tax/taxWrapper.ts` |
| `CorporateAction.actionType` | `stock_split`, `reverse_split`, `merger`, `spinoff` | `corporateActions.ts` |
| `TaxChecklistItem.itemKey` | `pit38`, `belka`, `pit_zg`, `rental`, `crypto`, `property_sales`, `attachments` | `tax/taxCalendar.ts` |
| `DocumentAttachment.entityType` | `property_cash_flow`, `transaction`, `income_event` | `documentAttachments.ts` |
| `AuditLog.entityType` | `transaction`, `asset_trade`, `internal_transfer`, `import_batch` | `auditLog.ts` |
| `AuditLog.action` | `create`, `update`, `delete` | `auditLog.ts` |
| `AccountSyncSetting.provider` | `stub`, `broker_api`, `bank_api` | `accountSync.ts` |
| `BankConnection.status` | `pending`, `connected`, `error` | `bankConnections.ts` |

## Valuation layers and recompute triggers

| Layer | Model | Role |
|-------|-------|------|
| Instrument prices | `InstrumentValuation` | Global EOD/manual prices (`source`: typically `manual` or `twelve_data`) |
| Daily snapshots | `AccountValuationDaily`, `HoldingValuationDaily` | Materialized charts / net worth history |
| Account-level NAV | `AssetValuation` | Manual dated value for RE / MANUAL / OTHER / PRECIOUS_METAL |
| FX history | `FxRateDaily` | NBP legs; `source` default `nbp` |

`recomputeAccountValuationsFrom` (and related helpers) runs after: lot CRUD / asset trades, cash transactions, manual revalue, asset valuation create, market-data sync, broker import commit, position transfers, mutating corporate actions (splits), and instrument valuation POST (caller’s holding accounts only).

## Categories (FR-015, DATA-011)

User-scoped `Category` tree (`parentId`, `sortOrder`). Defaults seeded on register (`ensureDefaultCategories`). `Transaction.categoryId` optional FK; legacy `Transaction.category` string kept for dividends/interest and display fallback.

`TransactionSplit` rows (`transactionId`, `categoryId`, `amount`) enable split expenses; when present, stats breakdown uses splits instead of the parent category string.

## Budgets (FR-017, DATA-012)

`Budget` — per user, per `categoryId`, per calendar month (`budgetMonth`), `amount` + `currency`. Unique on `(userId, categoryId, budgetMonth)`.

## Income events (FR-024, DATA-015)

`IncomeEvent` — dividends, interest, coupons, and capital-gain distributions separate from trade lots. `eventType`: `dividend` \| `interest` \| `coupon` \| `capital_gain_distribution`. Fields: `taxType` (`belka`, `pit38`, `exempt`), optional `instrumentId`, `withheldTax`, `sourceCountry`, `foreignTaxPaid`. Tax reports prefer income events over duplicate `Transaction` rows.

`Instrument.pitZgCountry` — ISO country for PIT/ZG helper (FR-028); default `PL`.

## Liabilities (FR-029, DATA-016)

`Liability` — `mortgage`, `loan`, `credit`, `tax_provision`, `tax_advance`; optional `accountId` link. Net worth = total assets − sum(liabilities).

## Property cash flows (FR-030, DATA-017)

`PropertyCashFlow` on `REAL_ESTATE` accounts — `rent`, `maintenance`, `other`. Feeds FR-026 rental section in tax report.

`Account.metalGrams` — optional grams on `PRECIOUS_METAL` accounts (FR-032).

## Asset valuations (DATA-024)

`AssetValuation` — dated manual value for `REAL_ESTATE`, `MANUAL`, `OTHER`, or `PRECIOUS_METAL` accounts (optional `instrumentId`). Creating a row with `accountId` updates `cashBalance` and valuation snapshots like manual revalue.

## Coupon schedules (FR-033)

`CouponSchedule` — planned bond/ETF `coupon` or `amortization` payment on a brokerage holding. `record-income` creates a linked `IncomeEvent` (`coupon` or `interest`).

## Automation (FR-034–038, NFR-002–003)

`CategorizationRule` — pattern (`contains` / `regex`) → `categoryId`; optional `priority`, `active`; applied on bank CSV import.

`AccountSyncSetting` — per-account `provider` (`stub` \| `broker_api` \| `bank_api`), `syncEnabled`, `syncIntervalHours`, `lastSyncAt` / `lastSyncStatus`, `configJson` (FR-035 stub; brokerage run may trigger market sync).

`BankConnection` — PSD2 stub on BANK accounts (`status`: `pending` \| `connected` \| `error`; optional `consentExpiresAt`, `errorMessage`) (FR-036).

`AuditLog` — `create` / `update` / `delete` snapshots for `transaction`, `asset_trade`, `internal_transfer`, `import_batch`.

## Tax wrappers (FR-039, DATA-018/023)

`Account.taxWrapperType` — `standard`, `ike`, `ikze`, `ppk` on brokerage accounts. IKE/IKZE/PPK holdings are excluded from PIT-38 unless a `TaxWrapperWithdrawal` with `includeInPit38` exists in the sell tax year.

`TaxWrapperWithdrawal` — `withdrawalType`: `partial` \| `full` \| `securities_transfer`.

`IkzeContribution` — annual IKZE deposits per account and tax year (account must be `ikze`).

## Position transfers (FR-041, DATA-020)

`PositionTransfer` — non-taxable move of open buy lots between **BROKERAGE → BROKERAGE** only (FIFO slice of cost basis preserved).

## Corporate actions (FR-040, DATA-019)

`CorporateAction` — audit log; `stock_split` / `reverse_split` apply lot ratio via split logic; `merger` / `spinoff` record only.

`HoldingLot.settlementDate` — optional; tax report uses it (fallback `tradeDate`) for PIT-38 year assignment.

## Tax completeness (FR-042–050)

`TaxLossCarryforward` — per-year capital loss balance; FR-022 applies oldest-first against net gains.

`TaxReportSnapshot` — optional JSON cache; invalidated when prior-year tax inputs change (FR-048).

`TaxChecklistItem` — local filing checklist; `itemKey` values in Domain enums (`pit38`, `belka`, …).

`PropertySale` — real estate disposal (`soldOn`, `proceeds`, `acquisitionCost`, `improvementsCost`, `fiveYearExemption`, `currency`, `description`) with taxable gain helper (FR-044, DATA-025).

`Account.rentalTaxMethod` — `scale` or `lump_sum_8_5` for FR-026 rental computation.

`DocumentAttachment` — metadata for tax evidence (FR-049); `entityType` in Domain enums; no binary storage.

`ImportPreset` — user-saved / built-in CSV column maps (FR-047); see CSV import section for runtime vs template scope.

## Related docs

- [api.md](api.md) — REST surface
- [architecture.md](../explanation/architecture.md) — auth and FX flow
- [tax-pl.md](../explanation/tax-pl.md) — PL tax assumptions
- [import-csv.md](../how-to/import-csv.md) — CSV import recipe
