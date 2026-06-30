import type { Account, AccountValuationPoint } from '../accountsApi'
import type { AuthConfig, AuthUser } from '../authApi'
import type { Transaction } from '../transactionsApi'
import type {
  CashflowStats,
  CategoryAmount,
  NetWorthStats,
  PortfolioSummary,
  PortfolioHistory,
  BenchmarkComparison,
  TaxReport,
} from '../statsApi'
import type { HoldingSummary } from '../holdingsApi'
import type { HoldingLot } from '../holdingLotsApi'
import type { ImportResult } from '../importApi'
import type { Instrument, InstrumentValuation } from '../instrumentsApi'
import type { MarketDataStatus, MarketDataSyncResult } from '../marketDataApi'
import type { HoldingValuationPoint } from '../valuationsApi'

/** Sample shapes produced by backend serializers in routeSupport.ts / statsRoutes.ts */
export const accountFixture: Account = {
  id: 1,
  accountType: 'BANK',
  name: 'Main',
  currency: 'PLN',
  cashBalance: 1500.5,
  totalBalance: 1500.5,
  openingBalance: 1000,
  openingCashAsOf: '2025-01-01T00:00:00.000Z',
  description: null,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-15T12:00:00.000Z',
}

export const transactionFixture: Transaction = {
  id: 10,
  accountId: 1,
  transactionType: 'EXPENSE',
  amount: 42.25,
  balanceAfter: 1458.25,
  currency: 'PLN',
  category: 'FOOD',
  date: '2025-01-10T12:00:00.000Z',
  description: 'Lunch',
}

export const cashflowFixture: CashflowStats = {
  income: 5000,
  expense: 3200.5,
  net: 1799.5,
  currency: 'PLN',
}

export const netWorthFixture: NetWorthStats = {
  total: 12000,
  currency: 'PLN',
  byAccountType: { BANK: 5000, BROKERAGE: 7000 },
  byBucket: [
    { bucket: 'cash', value: 5000, pct: 41.67 },
    { bucket: 'stock_market', value: 7000, pct: 58.33 },
    { bucket: 'crypto', value: 0, pct: 0 },
    { bucket: 'precious_metal_other', value: 0, pct: 0 },
    { bucket: 'real_estate', value: 0, pct: 0 },
  ],
  accounts: [
    { id: 1, name: 'Bank', accountType: 'BANK', value: 5000 },
    { id: 2, name: 'Broker', accountType: 'BROKERAGE', value: 7000 },
  ],
}

export const categoryAmountFixture: CategoryAmount[] = [
  { category: 'FOOD', amount: 120.5 },
  { category: 'TRAVEL', amount: 80 },
]

export const portfolioSummaryFixture: PortfolioSummary = {
  asOf: '2025-01-31T23:59:59.000Z',
  displayCurrency: 'PLN',
  totalValue: 7000,
  cashValue: 1500,
  securitiesValue: 5500,
  unrealizedPnl: 320,
  realizedPnlClosed: 0,
  returnPct: 4.5,
  allocation: [
    { type: 'CASH', value: 1500, pct: 21.43 },
    { type: 'ETF', value: 3000, pct: 42.86 },
    { type: 'STOCK', value: 2500, pct: 35.71 },
  ],
}

export const benchmarkComparisonFixture: BenchmarkComparison = {
  benchmark: 'SP500',
  benchmarkLabel: 'S&P 500 (proxy: SPY)',
  portfolioReturnPct: 4.5,
  benchmarkReturnPct: 3.2,
  displayCurrency: 'PLN',
}

export const portfolioHistoryFixture: PortfolioHistory = {
  points: [
    { date: '2025-01-01T00:00:00.000Z', totalValue: 6500, cashValue: 1500, securitiesValue: 5000 },
    { date: '2025-01-31T23:59:59.000Z', totalValue: 7000, cashValue: 1500, securitiesValue: 5500 },
  ],
}

export const taxReportFixture: TaxReport = {
  taxYear: 2025,
  displayCurrency: 'PLN',
  realizedGains: 500,
  realizedLosses: 100,
  netRealized: 400,
  estimatedBelka: 76,
  dividendsGross: 50,
  byAccount: [{ accountId: 2, name: 'Broker', netRealized: 400 }],
  byInstrument: [{ symbol: 'AAA', netRealized: 400 }],
  sellRows: [
    {
      saleDate: '2025-04-01T12:00:00.000Z',
      symbol: 'AAA',
      accountId: 2,
      accountName: 'Broker',
      quantity: 4,
      proceeds: 480,
      cost: 400,
      gainLoss: 80,
      currency: 'PLN',
    },
  ],
  warnings: [],
}

export const holdingSummaryFixture: HoldingSummary = {
  id: 1,
  accountId: 2,
  instrumentId: 10,
  quantity: 6,
  instrument: {
    id: 10,
    symbol: 'AAA',
    name: 'Example SA',
    instrumentType: 'STOCK',
    exchange: 'GPW',
    currency: 'PLN',
  },
  marketValue: 720,
  costBasis: 600,
  unrealizedPnl: 120,
  realizedPnl: null,
  lastTradeDate: '2025-04-01T12:00:00.000Z',
}

export const importResultFixture: ImportResult = {
  dryRun: true,
  parsed: 2,
  imported: 0,
  skipped: 0,
  errors: [],
  preview: [
    {
      row: 1,
      kind: 'TRADE',
      tradeDate: '2025-01-15',
      symbol: 'AAPL',
      side: 'BUY',
      quantity: 1,
      price: 150,
      amount: 150,
      currency: 'USD',
    },
  ],
}

export const instrumentFixture: Instrument = {
  id: 10,
  instrumentType: 'STOCK',
  symbol: 'AAA',
  name: 'Example SA',
  exchange: 'GPW',
  currency: 'PLN',
  source: 'manual',
  createdAt: '2025-01-01T00:00:00.000Z',
}

export const instrumentValuationFixture: InstrumentValuation = {
  id: 1,
  instrumentId: 10,
  valuationDate: '2025-01-10T12:00:00.000Z',
  price: 110,
  currency: 'PLN',
  source: 'manual',
}

export const holdingLotFixture: HoldingLot = {
  id: 5,
  holdingId: 1,
  accountId: 2,
  instrumentId: 10,
  side: 'BUY',
  quantity: 10,
  quantityAfter: 10,
  totalPrice: 1000,
  commission: 5,
  pricePerUnit: 100,
  currency: 'PLN',
  tradeDate: '2025-01-05T12:00:00.000Z',
  createdAt: '2025-01-05T12:00:00.000Z',
}

export const accountValuationPointFixture: AccountValuationPoint = {
  valuationDate: '2025-01-31T23:59:59.000Z',
  totalValue: 7000,
  cashValue: 1500,
  securitiesValue: 5500,
  currency: 'PLN',
}

export const holdingValuationPointFixture: HoldingValuationPoint = {
  valuationDate: '2025-01-31T23:59:59.000Z',
  quantity: 10,
  marketValue: 1100,
  currency: 'PLN',
}

export const marketDataStatusFixture: MarketDataStatus = {
  lastSyncAt: '2025-01-31T22:00:00.000Z',
  instrumentCount: 12,
  staleCount: 1,
}

export const marketDataSyncResultFixture: MarketDataSyncResult = {
  synced: 5,
  skipped: 2,
  valuationsUpserted: 10,
  accountsRecomputed: 3,
  errors: [],
}

export const authUserFixture: AuthUser = {
  id: 1,
  email: 'user@example.com',
  username: 'user',
}

export const authConfigFixture: AuthConfig = {
  allowRegister: true,
}

function assertAccountShape(value: Account): void {
  if (typeof value.id !== 'number') throw new Error('account.id')
  if (!['BANK', 'BROKERAGE', 'MANUAL'].includes(value.accountType)) throw new Error('account.accountType')
  if (typeof value.cashBalance !== 'number') throw new Error('account.cashBalance')
  if (typeof value.totalBalance !== 'number') throw new Error('account.totalBalance')
  if (typeof value.openingBalance !== 'number') throw new Error('account.openingBalance')
  if (value.openingCashAsOf !== null && typeof value.openingCashAsOf !== 'string') {
    throw new Error('account.openingCashAsOf')
  }
}

function assertTransactionShape(value: Transaction): void {
  if (typeof value.balanceAfter !== 'number') throw new Error('transaction.balanceAfter')
  if (typeof value.amount !== 'number') throw new Error('transaction.amount')
  if (!value.date.includes('T')) throw new Error('transaction.date ISO')
}

function assertCashflowShape(value: CashflowStats): void {
  if (typeof value.net !== 'number') throw new Error('cashflow.net')
  if (value.net !== value.income - value.expense) throw new Error('cashflow arithmetic')
}

function assertNetWorthShape(value: NetWorthStats): void {
  if (typeof value.total !== 'number') throw new Error('netWorth.total')
  if (typeof value.byAccountType !== 'object') throw new Error('netWorth.byAccountType')
  if (!Array.isArray(value.byBucket) || value.byBucket.length !== 5) {
    throw new Error('netWorth.byBucket')
  }
  if (!Array.isArray(value.accounts)) throw new Error('netWorth.accounts')
}

function assertCategoryAmountsShape(value: CategoryAmount[]): void {
  for (const row of value) {
    if (typeof row.category !== 'string') throw new Error('categoryAmount.category')
    if (typeof row.amount !== 'number') throw new Error('categoryAmount.amount')
  }
}

function assertPortfolioSummaryShape(value: PortfolioSummary): void {
  if (typeof value.totalValue !== 'number') throw new Error('portfolioSummary.totalValue')
  if (!Array.isArray(value.allocation)) throw new Error('portfolioSummary.allocation')
}

function assertBenchmarkComparisonShape(value: BenchmarkComparison): void {
  if (typeof value.benchmarkLabel !== 'string') throw new Error('benchmarkComparison.benchmarkLabel')
  if (value.benchmark !== 'WIG' && value.benchmark !== 'SP500') throw new Error('benchmarkComparison.benchmark')
}

function assertPortfolioHistoryShape(value: PortfolioHistory): void {
  if (!Array.isArray(value.points)) throw new Error('portfolioHistory.points')
  for (const point of value.points) {
    if (!point.date.includes('T')) throw new Error('portfolioHistory.point.date')
    if (typeof point.totalValue !== 'number') throw new Error('portfolioHistory.point.totalValue')
  }
}

function assertTaxReportShape(value: TaxReport): void {
  if (typeof value.taxYear !== 'number') throw new Error('taxReport.taxYear')
  if (!Array.isArray(value.sellRows)) throw new Error('taxReport.sellRows')
  if (!Array.isArray(value.warnings)) throw new Error('taxReport.warnings')
}

function assertHoldingSummaryShape(value: HoldingSummary): void {
  if (typeof value.quantity !== 'number') throw new Error('holdingSummary.quantity')
  if (typeof value.instrument.symbol !== 'string') throw new Error('holdingSummary.instrument.symbol')
}

function assertImportResultShape(value: ImportResult): void {
  if (typeof value.parsed !== 'number') throw new Error('importResult.parsed')
  if (!Array.isArray(value.errors)) throw new Error('importResult.errors')
}

function assertInstrumentShape(value: Instrument): void {
  if (typeof value.symbol !== 'string') throw new Error('instrument.symbol')
  if (!value.createdAt.includes('T')) throw new Error('instrument.createdAt ISO')
}

function assertInstrumentValuationShape(value: InstrumentValuation): void {
  if (typeof value.price !== 'number') throw new Error('instrumentValuation.price')
  if (!value.valuationDate.includes('T')) throw new Error('instrumentValuation.valuationDate ISO')
}

function assertHoldingLotShape(value: HoldingLot): void {
  if (!['BUY', 'SELL'].includes(value.side)) throw new Error('holdingLot.side')
  if (typeof value.quantityAfter !== 'number') throw new Error('holdingLot.quantityAfter')
  if (typeof value.commission !== 'number') throw new Error('holdingLot.commission')
}

function assertAccountValuationPointShape(value: AccountValuationPoint): void {
  if (typeof value.totalValue !== 'number') throw new Error('accountValuationPoint.totalValue')
  if (!value.valuationDate.includes('T')) throw new Error('accountValuationPoint.valuationDate ISO')
}

function assertHoldingValuationPointShape(value: HoldingValuationPoint): void {
  if (typeof value.marketValue !== 'number') throw new Error('holdingValuationPoint.marketValue')
}

function assertMarketDataStatusShape(value: MarketDataStatus): void {
  if (typeof value.instrumentCount !== 'number') throw new Error('marketDataStatus.instrumentCount')
}

function assertMarketDataSyncResultShape(value: MarketDataSyncResult): void {
  if (typeof value.synced !== 'number') throw new Error('marketDataSyncResult.synced')
  if (!Array.isArray(value.errors)) throw new Error('marketDataSyncResult.errors')
}

function assertAuthUserShape(value: AuthUser): void {
  if (typeof value.email !== 'string') throw new Error('authUser.email')
}

function assertAuthConfigShape(value: AuthConfig): void {
  if (typeof value.allowRegister !== 'boolean') throw new Error('authConfig.allowRegister')
}

export function validateApiContractFixtures(): void {
  assertAccountShape(accountFixture)
  assertTransactionShape(transactionFixture)
  assertCashflowShape(cashflowFixture)
  assertNetWorthShape(netWorthFixture)
  assertCategoryAmountsShape(categoryAmountFixture)
  assertPortfolioSummaryShape(portfolioSummaryFixture)
  assertBenchmarkComparisonShape(benchmarkComparisonFixture)
  assertPortfolioHistoryShape(portfolioHistoryFixture)
  assertTaxReportShape(taxReportFixture)
  assertHoldingSummaryShape(holdingSummaryFixture)
  assertImportResultShape(importResultFixture)
  assertInstrumentShape(instrumentFixture)
  assertInstrumentValuationShape(instrumentValuationFixture)
  assertHoldingLotShape(holdingLotFixture)
  assertAccountValuationPointShape(accountValuationPointFixture)
  assertHoldingValuationPointShape(holdingValuationPointFixture)
  assertMarketDataStatusShape(marketDataStatusFixture)
  assertMarketDataSyncResultShape(marketDataSyncResultFixture)
  assertAuthUserShape(authUserFixture)
  assertAuthConfigShape(authConfigFixture)
}
