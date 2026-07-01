import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  setAuthToken: vi.fn(),
}))

import { apiClient, setAuthToken } from './client'
import { register, login, fetchMe, logoutLocal, fetchAuthConfig, updateProfile, updatePassword, updateEmail } from './authApi'
import {
  fetchAccounts,
  fetchAccount,
  fetchAccountStats,
  createAccount,
  updateAccount,
  deleteAccount,
  fetchAccountValuations,
  revalueAccount,
} from './accountsApi'
import {
  fetchTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from './transactionsApi'
import {
  fetchAccountHoldings,
  fetchAccountAssetHolding,
  fetchHolding,
  createHolding,
  applyStockSplit,
} from './holdingsApi'
import {
  fetchHoldingLots,
  createHoldingLot,
  deleteHoldingLot,
} from './holdingLotsApi'
import {
  fetchInstruments,
  fetchInstrument,
  createInstrument,
  fetchInstrumentValuations,
  createInstrumentValuation,
} from './instrumentsApi'
import { fetchHoldingValuations } from './valuationsApi'
import {
  fetchNetWorth,
  fetchAverageHoldingReturn,
  fetchCashflow,
  fetchCashflowHistory,
  fetchCashflowRolling12m,
  fetchExpensesByCategory,
  fetchIncomeByCategory,
  fetchPortfolioSummary,
  fetchPortfolioHistory,
  fetchBenchmarkComparison,
  fetchTaxReport,
} from './statsApi'
import { fetchMarketDataStatus, triggerMarketSync } from './marketDataApi'
import { importBrokerTrades, importBankTransactions } from './importApi'
import { fetchPortfolioPositions } from './portfolioApi'
import { createAssetTrade, fetchAssetTrades } from './assetTradesApi'
import {
  createInternalTransfer,
  deleteInternalTransfer,
  fetchInternalTransferFxSuggestion,
  fetchInternalTransfers,
} from './internalTransfersApi'
import {
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from './categoriesApi'
import { fetchBudgets, upsertBudget, deleteBudget } from './budgetsApi'
import { fetchIncomeEvents, createIncomeEvent, updateIncomeEvent, deleteIncomeEvent } from './incomeEventsApi'
import {
  fetchLiabilities,
  createLiability,
  updateLiability,
  deleteLiability,
} from './liabilitiesApi'
import {
  fetchPropertyCashFlows,
  createPropertyCashFlow,
  deletePropertyCashFlow,
  updatePropertyCashFlow,
} from './propertyCashFlowsApi'
import {
  fetchTaxWrapperWithdrawals,
  createTaxWrapperWithdrawal,
  deleteTaxWrapperWithdrawal,
  fetchIkzeContributions,
  createIkzeContribution,
  deleteIkzeContribution,
} from './taxWrappersApi'
import { fetchPositionTransfers, createPositionTransfer } from './positionTransfersApi'
import { fetchCorporateActions, createCorporateAction } from './corporateActionsApi'
import { fetchTaxOverview, simulatePreSellTax } from './taxOverviewApi'
import { fetchTaxLossCarryforwards, upsertTaxLossCarryforward, deleteTaxLossCarryforward } from './taxLossCarryforwardApi'
import { fetchPropertySales, createPropertySale, deletePropertySale } from './propertySalesApi'
import { fetchTaxCalendar, updateTaxChecklistItem } from './taxCalendarApi'
import { fetchImportPresets, createImportPreset, deleteImportPreset } from './importPresetsApi'
import { fetchDocumentAttachments, createDocumentAttachment, deleteDocumentAttachment } from './documentAttachmentsApi'
import {
  fetchAssetValuations,
  createAssetValuation,
  deleteAssetValuation,
} from './assetValuationsApi'
import {
  fetchCouponSchedules,
  createCouponSchedule,
  recordCouponScheduleIncome,
  deleteCouponSchedule,
} from './couponSchedulesApi'
import {
  fetchCategorizationRules,
  createCategorizationRule,
  deleteCategorizationRule,
  updateCategorizationRule,
} from './categorizationRulesApi'
import { fetchBudgetAlerts } from './budgetsApi'
import { fetchAccountSyncSettings, upsertAccountSyncSetting, runAccountSync } from './accountSyncApi'
import {
  fetchBankConnections,
  createBankConnection,
  authorizeBankConnection,
  deleteBankConnection,
} from './bankConnectionsApi'
import { fetchFullExport, fetchAuditLogs } from './exportApi'

describe('API modules', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockResolvedValue({})
    vi.mocked(apiClient.post).mockResolvedValue({ token: 't', user: {} })
    vi.mocked(apiClient.put).mockResolvedValue({})
    vi.mocked(apiClient.patch).mockResolvedValue({})
    vi.mocked(apiClient.delete).mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('authApi calls correct endpoints', async () => {
    await fetchAuthConfig()
    expect(apiClient.get).toHaveBeenCalledWith('/api/auth/config')

    await register('a@b.c', 'user', 'pass')
    expect(apiClient.post).toHaveBeenCalledWith('/api/auth/register', {
      email: 'a@b.c',
      username: 'user',
      password: 'pass',
    })

    await login('a@b.c', 'pass')
    expect(apiClient.post).toHaveBeenCalledWith('/api/auth/login', {
      login: 'a@b.c',
      password: 'pass',
    })

    await fetchMe()
    expect(apiClient.get).toHaveBeenCalledWith('/api/auth/me')

    await updateProfile('newname')
    expect(apiClient.patch).toHaveBeenCalledWith('/api/auth/profile', { username: 'newname' })

    await updatePassword('old', 'newpass99')
    expect(apiClient.patch).toHaveBeenCalledWith('/api/auth/password', {
      currentPassword: 'old',
      newPassword: 'newpass99',
    })

    await updateEmail('x@y.z', 'old')
    expect(apiClient.patch).toHaveBeenCalledWith('/api/auth/email', {
      email: 'x@y.z',
      currentPassword: 'old',
    })

    logoutLocal()
    expect(setAuthToken).toHaveBeenCalledWith(null)
  })

  it('accountsApi calls correct endpoints', async () => {
    await fetchAccounts()
    expect(apiClient.get).toHaveBeenCalledWith('/api/accounts')

    await fetchAccount(3)
    expect(apiClient.get).toHaveBeenCalledWith('/api/accounts/3')

    await fetchAccountStats(3, 'EUR')
    expect(apiClient.get).toHaveBeenCalledWith('/api/accounts/3/stats?currency=EUR')

    await createAccount({
      accountType: 'BANK',
      name: 'Main',
      currency: 'PLN',
    })
    expect(apiClient.post).toHaveBeenCalledWith('/api/accounts', {
      accountType: 'BANK',
      name: 'Main',
      currency: 'PLN',
    })

    await updateAccount(2, { name: 'Renamed' })
    expect(apiClient.put).toHaveBeenCalledWith('/api/accounts/2', { name: 'Renamed' })

    await deleteAccount(9)
    expect(apiClient.delete).toHaveBeenCalledWith('/api/accounts/9')

    await fetchAccountValuations(1, '2025-01-01', '2025-01-31')
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/accounts/1/valuations?from=2025-01-01&to=2025-01-31',
    )

    await revalueAccount(1, { value: 100_000, valuationDate: '2025-06-01' })
    expect(apiClient.post).toHaveBeenCalledWith('/api/accounts/1/revalue', {
      value: 100_000,
      valuationDate: '2025-06-01',
    })
  })

  it('transactionsApi calls correct endpoints', async () => {
    await fetchTransactions({ from: '2025-01-01', to: '2025-01-31', accountId: 4 })
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/transactions?from=2025-01-01&to=2025-01-31&accountId=4',
    )

    const input = {
      accountId: 1,
      transactionType: 'INCOME' as const,
      amount: 10,
      currency: 'PLN',
      category: 'SALARY',
      date: '2025-01-01',
    }
    await createTransaction(input)
    expect(apiClient.post).toHaveBeenCalledWith('/api/transactions', input)

    await updateTransaction(5, { amount: 20 })
    expect(apiClient.put).toHaveBeenCalledWith('/api/transactions/5', { amount: 20 })

    await deleteTransaction(6)
    expect(apiClient.delete).toHaveBeenCalledWith('/api/transactions/6')
  })

  it('holdingsApi calls correct endpoints', async () => {
    await fetchAccountHoldings(7)
    expect(apiClient.get).toHaveBeenCalledWith('/api/accounts/7/holdings')

    await fetchHolding(8)
    expect(apiClient.get).toHaveBeenCalledWith('/api/holdings/8')

    await fetchAccountAssetHolding(7, 11)
    expect(apiClient.get).toHaveBeenCalledWith('/api/accounts/7/assets/11')

    await createHolding(2, 11)
    expect(apiClient.post).toHaveBeenCalledWith('/api/accounts/2/holdings', {
      instrumentId: 11,
    })

    await applyStockSplit(5, { ratio: 4, effectiveDate: '2025-01-01' })
    expect(apiClient.post).toHaveBeenCalledWith('/api/holdings/5/split', {
      ratio: 4,
      effectiveDate: '2025-01-01',
    })
  })

  it('holdingLotsApi calls correct endpoints', async () => {
    const lotInput = {
      side: 'BUY' as const,
      quantity: 1,
      pricePerUnit: 10,
      currency: 'USD',
      tradeDate: '2025-01-01',
    }
    await fetchHoldingLots(3)
    expect(apiClient.get).toHaveBeenCalledWith('/api/holdings/3/lots')

    await createHoldingLot(3, lotInput)
    expect(apiClient.post).toHaveBeenCalledWith('/api/holdings/3/lots', lotInput)

    await deleteHoldingLot(12)
    expect(apiClient.delete).toHaveBeenCalledWith('/api/holding-lots/12')
  })

  it('instrumentsApi calls correct endpoints', async () => {
    await fetchInstruments('AAPL')
    expect(apiClient.get).toHaveBeenCalledWith('/api/instruments?q=AAPL')

    await fetchInstrument(4)
    expect(apiClient.get).toHaveBeenCalledWith('/api/instruments/4')

    const instrumentInput = {
      instrumentType: 'STOCK',
      symbol: 'VT',
      currency: 'USD',
    }
    await createInstrument(instrumentInput)
    expect(apiClient.post).toHaveBeenCalledWith('/api/instruments', instrumentInput)

    await fetchInstrumentValuations(4, { from: '2025-01-01', to: '2025-01-31' })
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/instruments/4/valuations?from=2025-01-01&to=2025-01-31',
    )

    const valuationInput = {
      valuationDate: '2025-01-10',
      price: 100,
    }
    await createInstrumentValuation(4, valuationInput)
    expect(apiClient.post).toHaveBeenCalledWith('/api/instruments/4/valuations', valuationInput)
  })

  it('valuationsApi calls correct endpoints', async () => {
    await fetchHoldingValuations(1, 2, '2025-01-01', '2025-01-31')
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/accounts/1/holdings/2/valuations?from=2025-01-01&to=2025-01-31',
    )
  })

  it('statsApi calls correct endpoints', async () => {
    await fetchNetWorth('EUR')
    expect(apiClient.get).toHaveBeenCalledWith('/api/stats/net-worth?currency=EUR')

    await fetchAverageHoldingReturn('PLN')
    expect(apiClient.get).toHaveBeenCalledWith('/api/stats/average-holding-return?currency=PLN')

    await fetchCashflow({ from: '2025-01-01', to: '2025-01-31', currency: 'PLN' })
    expect(apiClient.get).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/stats\/cashflow\?/),
    )
    expect(apiClient.get).toHaveBeenCalledWith(
      expect.stringMatching(/from=2025-01-01/),
    )

    await fetchCashflowHistory({ from: '2024-01-01', to: '2024-12-31', currency: 'PLN' })
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/stats/cashflow-history?from=2024-01-01&to=2024-12-31&currency=PLN',
    )

    await fetchCashflowRolling12m('EUR')
    expect(apiClient.get).toHaveBeenCalledWith('/api/stats/cashflow-rolling-12m?currency=EUR')

    await fetchExpensesByCategory({ from: '2025-01-01', to: '2025-01-31' })
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/stats/expenses-by-category?from=2025-01-01&to=2025-01-31',
    )

    await fetchIncomeByCategory({ from: '2025-01-01', to: '2025-01-31' })
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/stats/income-by-category?from=2025-01-01&to=2025-01-31',
    )

    await fetchPortfolioSummary({ from: '2025-01-01', to: '2025-01-31', currency: 'PLN' })
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/stats/portfolio-summary?from=2025-01-01&to=2025-01-31&currency=PLN',
    )

    await fetchPortfolioHistory({ from: '2025-01-01', to: '2025-01-31' })
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/stats/portfolio-history?from=2025-01-01&to=2025-01-31',
    )

    await fetchBenchmarkComparison({
      from: '2025-01-01',
      to: '2025-01-31',
      currency: 'USD',
      benchmark: 'SP500',
    })
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/stats/benchmark-comparison?from=2025-01-01&to=2025-01-31&currency=USD&benchmark=SP500',
    )

    await fetchTaxReport(2025, 'PLN')
    expect(apiClient.get).toHaveBeenCalledWith('/api/stats/tax-report?year=2025&currency=PLN')
  })

  it('marketDataApi calls correct endpoints', async () => {
    await fetchMarketDataStatus()
    expect(apiClient.get).toHaveBeenCalledWith('/api/market-data/status')

    await triggerMarketSync()
    expect(apiClient.post).toHaveBeenCalledWith('/api/market-data/sync', {})

    await triggerMarketSync(30)
    expect(apiClient.post).toHaveBeenCalledWith('/api/market-data/sync', { backfillDays: 30 })
  })

  it('importApi calls correct endpoints', async () => {
    await importBrokerTrades({ accountId: 3, csv: 'ID;Type;Time;Comment;Symbol;Amount', dryRun: true })
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/import/broker-trades?accountId=3&broker=xtb&dryRun=true',
      {
        csv: 'ID;Type;Time;Comment;Symbol;Amount',
        filename: undefined,
        dryRun: true,
      },
    )

    await importBankTransactions({
      accountId: 2,
      bank: 'mbank',
      csv: 'Date;Amount;-10',
      dryRun: true,
    })
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/import/bank-transactions?accountId=2&bank=mbank&dryRun=true',
      {
        csv: 'Date;Amount;-10',
        filename: undefined,
        dryRun: true,
      },
    )
  })

  it('portfolioApi calls correct endpoints', async () => {
    await fetchPortfolioPositions({ accountId: 2, instrumentType: 'STOCK', assetBucket: 'stock_market' })
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/portfolio/positions?accountId=2&instrumentType=STOCK&assetBucket=stock_market',
    )
  })

  it('assetTradesApi calls correct endpoints', async () => {
    await fetchAssetTrades({ from: '2025-01-01', to: '2025-01-31', accountId: 3, instrumentId: 9 })
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/asset-trades?from=2025-01-01&to=2025-01-31&accountId=3&instrumentId=9',
    )

    await createAssetTrade({
      accountId: 3,
      instrumentId: 9,
      side: 'BUY',
      quantity: 2,
      pricePerUnit: 50,
      commission: 2.5,
      currency: 'PLN',
      tradeDate: '2025-02-01T00:00:00.000Z',
    })
    expect(apiClient.post).toHaveBeenCalledWith('/api/asset-trades', {
      accountId: 3,
      instrumentId: 9,
      side: 'BUY',
      quantity: 2,
      pricePerUnit: 50,
      commission: 2.5,
      currency: 'PLN',
      tradeDate: '2025-02-01T00:00:00.000Z',
    })
  })

  it('internalTransfersApi calls correct endpoints', async () => {
    await fetchInternalTransfers({ from: '2025-01-01', to: '2025-01-31', accountId: 2 })
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/internal-transfers?from=2025-01-01&to=2025-01-31&accountId=2',
    )

    await fetchInternalTransferFxSuggestion({
      fromCurrency: 'USD',
      toCurrency: 'PLN',
      fromAmount: 100,
    })
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/internal-transfers/fx-suggestion?fromCurrency=USD&toCurrency=PLN&fromAmount=100',
    )

    await createInternalTransfer({
      fromAccountId: 1,
      toAccountId: 2,
      fromAmount: 100,
      toAmount: 100,
      date: '2025-02-01T00:00:00.000Z',
    })
    expect(apiClient.post).toHaveBeenCalledWith('/api/internal-transfers', {
      fromAccountId: 1,
      toAccountId: 2,
      fromAmount: 100,
      toAmount: 100,
      date: '2025-02-01T00:00:00.000Z',
    })

    await deleteInternalTransfer('group-1')
    expect(apiClient.delete).toHaveBeenCalledWith('/api/internal-transfers/group-1')
  })

  it('categoriesApi calls correct endpoints', async () => {
    await fetchCategories()
    expect(apiClient.get).toHaveBeenCalledWith('/api/categories')

    await createCategory({ name: 'Food', parentId: null, sortOrder: 1 })
    expect(apiClient.post).toHaveBeenCalledWith('/api/categories', {
      name: 'Food',
      parentId: null,
      sortOrder: 1,
    })

    await updateCategory(5, { name: 'Groceries' })
    expect(apiClient.put).toHaveBeenCalledWith('/api/categories/5', { name: 'Groceries' })

    await deleteCategory(5)
    expect(apiClient.delete).toHaveBeenCalledWith('/api/categories/5')
  })

  it('budgetsApi calls correct endpoints', async () => {
    await fetchBudgets('2026-06', 'PLN')
    expect(apiClient.get).toHaveBeenCalledWith('/api/budgets?month=2026-06&currency=PLN')

    await upsertBudget({
      categoryId: 3,
      budgetMonth: '2026-06-01',
      amount: 500,
      currency: 'PLN',
    })
    expect(apiClient.put).toHaveBeenCalledWith('/api/budgets', {
      categoryId: 3,
      budgetMonth: '2026-06-01',
      amount: 500,
      currency: 'PLN',
    })

    await deleteBudget(7)
    expect(apiClient.delete).toHaveBeenCalledWith('/api/budgets/7')
  })

  it('incomeEventsApi calls correct endpoints', async () => {
    await fetchIncomeEvents({ from: '2026-01-01', to: '2026-12-31', accountId: 2 })
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/income-events?from=2026-01-01&to=2026-12-31&accountId=2',
    )

    await createIncomeEvent({
      accountId: 2,
      eventType: 'dividend',
      amount: 50,
      currency: 'PLN',
      date: '2026-05-01',
    })
    expect(apiClient.post).toHaveBeenCalledWith('/api/income-events', {
      accountId: 2,
      eventType: 'dividend',
      amount: 50,
      currency: 'PLN',
      date: '2026-05-01',
    })

    await updateIncomeEvent(4, { amount: 60 })
    expect(apiClient.put).toHaveBeenCalledWith('/api/income-events/4', { amount: 60 })

    await deleteIncomeEvent(4)
    expect(apiClient.delete).toHaveBeenCalledWith('/api/income-events/4')
  })

  it('liabilitiesApi calls correct endpoints', async () => {
    await fetchLiabilities()
    expect(apiClient.get).toHaveBeenCalledWith('/api/liabilities')

    await createLiability({
      name: 'Mortgage',
      liabilityType: 'mortgage',
      balance: 100000,
      currency: 'PLN',
    })
    expect(apiClient.post).toHaveBeenCalledWith('/api/liabilities', {
      name: 'Mortgage',
      liabilityType: 'mortgage',
      balance: 100000,
      currency: 'PLN',
    })

    await updateLiability(2, { balance: 90000 })
    expect(apiClient.put).toHaveBeenCalledWith('/api/liabilities/2', { balance: 90000 })

    await deleteLiability(2)
    expect(apiClient.delete).toHaveBeenCalledWith('/api/liabilities/2')
  })

  it('propertyCashFlowsApi calls correct endpoints', async () => {
    await fetchPropertyCashFlows({ accountId: 5 })
    expect(apiClient.get).toHaveBeenCalledWith('/api/property-cash-flows?accountId=5')

    await createPropertyCashFlow({
      accountId: 5,
      flowType: 'rent',
      amount: 2000,
      currency: 'PLN',
      date: '2026-06-01',
    })
    expect(apiClient.post).toHaveBeenCalledWith('/api/property-cash-flows', {
      accountId: 5,
      flowType: 'rent',
      amount: 2000,
      currency: 'PLN',
      date: '2026-06-01',
    })

    await deletePropertyCashFlow(8)
    expect(apiClient.delete).toHaveBeenCalledWith('/api/property-cash-flows/8')
  })

  it('taxWrappersApi calls correct endpoints', async () => {
    await fetchTaxWrapperWithdrawals({ accountId: 2 })
    expect(apiClient.get).toHaveBeenCalledWith('/api/tax-wrapper-withdrawals?accountId=2')

    await createTaxWrapperWithdrawal({
      accountId: 2,
      amount: 1000,
      currency: 'PLN',
      withdrawnOn: '2026-06-01',
      withdrawalType: 'partial',
    })
    expect(apiClient.post).toHaveBeenCalledWith('/api/tax-wrapper-withdrawals', {
      accountId: 2,
      amount: 1000,
      currency: 'PLN',
      withdrawnOn: '2026-06-01',
      withdrawalType: 'partial',
    })

    await deleteTaxWrapperWithdrawal(3)
    expect(apiClient.delete).toHaveBeenCalledWith('/api/tax-wrapper-withdrawals/3')

    await fetchIkzeContributions({ taxYear: 2026 })
    expect(apiClient.get).toHaveBeenCalledWith('/api/ikze-contributions?taxYear=2026')

    await createIkzeContribution({
      accountId: 2,
      taxYear: 2026,
      amount: 500,
      currency: 'PLN',
      contributedOn: '2026-03-01',
    })
    expect(apiClient.post).toHaveBeenCalledWith('/api/ikze-contributions', {
      accountId: 2,
      taxYear: 2026,
      amount: 500,
      currency: 'PLN',
      contributedOn: '2026-03-01',
    })

    await deleteIkzeContribution(4)
    expect(apiClient.delete).toHaveBeenCalledWith('/api/ikze-contributions/4')
  })

  it('positionTransfersApi calls correct endpoints', async () => {
    await fetchPositionTransfers({ accountId: 1 })
    expect(apiClient.get).toHaveBeenCalledWith('/api/position-transfers?accountId=1')

    await createPositionTransfer({
      fromAccountId: 1,
      toAccountId: 2,
      instrumentId: 5,
      quantity: 10,
      transferDate: '2026-06-01',
    })
    expect(apiClient.post).toHaveBeenCalledWith('/api/position-transfers', {
      fromAccountId: 1,
      toAccountId: 2,
      instrumentId: 5,
      quantity: 10,
      transferDate: '2026-06-01',
    })
  })

  it('corporateActionsApi calls correct endpoints', async () => {
    await fetchCorporateActions({ accountId: 2 })
    expect(apiClient.get).toHaveBeenCalledWith('/api/corporate-actions?accountId=2')

    await createCorporateAction({
      accountId: 2,
      instrumentId: 5,
      actionType: 'stock_split',
      actionDate: '2026-06-01',
      ratio: 2,
    })
    expect(apiClient.post).toHaveBeenCalledWith('/api/corporate-actions', {
      accountId: 2,
      instrumentId: 5,
      actionType: 'stock_split',
      actionDate: '2026-06-01',
      ratio: 2,
    })
  })

  it('taxOverviewApi calls correct endpoints', async () => {
    await fetchTaxOverview(2026, 'PLN', true)
    expect(apiClient.get).toHaveBeenCalledWith('/api/stats/tax-overview?year=2026&currency=PLN&snapshot=1')

    await simulatePreSellTax({ holdingId: 3, quantity: 5, currency: 'PLN' })
    expect(apiClient.post).toHaveBeenCalledWith('/api/stats/pre-sell-simulator', {
      holdingId: 3,
      quantity: 5,
      currency: 'PLN',
    })
  })

  it('taxLossCarryforwardApi calls correct endpoints', async () => {
    await fetchTaxLossCarryforwards()
    expect(apiClient.get).toHaveBeenCalledWith('/api/tax-loss-carryforward')

    await upsertTaxLossCarryforward({ taxYear: 2024, lossAmount: 1000 })
    expect(apiClient.put).toHaveBeenCalledWith('/api/tax-loss-carryforward', {
      taxYear: 2024,
      lossAmount: 1000,
    })
  })

  it('propertySalesApi calls correct endpoints', async () => {
    await fetchPropertySales({ accountId: 2 })
    expect(apiClient.get).toHaveBeenCalledWith('/api/property-sales?accountId=2')

    await createPropertySale({
      accountId: 2,
      soldOn: '2026-06-01',
      proceeds: 400000,
      acquisitionCost: 300000,
      currency: 'PLN',
    })
    expect(apiClient.post).toHaveBeenCalledWith('/api/property-sales', {
      accountId: 2,
      soldOn: '2026-06-01',
      proceeds: 400000,
      acquisitionCost: 300000,
      currency: 'PLN',
    })
  })

  it('taxCalendarApi calls correct endpoints', async () => {
    await fetchTaxCalendar(2026)
    expect(apiClient.get).toHaveBeenCalledWith('/api/tax-calendar?year=2026')

    await updateTaxChecklistItem(2026, 'pit38', true)
    expect(apiClient.put).toHaveBeenCalledWith('/api/tax-checklist', {
      taxYear: 2026,
      itemKey: 'pit38',
      completed: true,
    })
  })

  it('importPresetsApi calls correct endpoints', async () => {
    await fetchImportPresets()
    expect(apiClient.get).toHaveBeenCalledWith('/api/import/presets')

    await createImportPreset({
      name: 'My XTB',
      broker: 'xtb',
      targetType: 'asset_transaction',
      columnMapping: {},
    })
    expect(apiClient.post).toHaveBeenCalledWith('/api/import/presets', {
      name: 'My XTB',
      broker: 'xtb',
      targetType: 'asset_transaction',
      columnMapping: {},
    })
  })

  it('documentAttachmentsApi calls correct endpoints', async () => {
    await fetchDocumentAttachments({ entityType: 'income_event', entityId: 4 })
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/document-attachments?entityType=income_event&entityId=4',
    )

    await createDocumentAttachment({
      entityType: 'income_event',
      entityId: 4,
      filename: 'invoice.pdf',
    })
    expect(apiClient.post).toHaveBeenCalledWith('/api/document-attachments', {
      entityType: 'income_event',
      entityId: 4,
      filename: 'invoice.pdf',
    })
  })

  it('assetValuationsApi calls correct endpoints', async () => {
    await fetchAssetValuations({ accountId: 3 })
    expect(apiClient.get).toHaveBeenCalledWith('/api/asset-valuations?accountId=3')

    await createAssetValuation({
      accountId: 3,
      value: 500000,
      currency: 'PLN',
      date: '2026-01-01',
    })
    expect(apiClient.post).toHaveBeenCalledWith('/api/asset-valuations', {
      accountId: 3,
      value: 500000,
      currency: 'PLN',
      date: '2026-01-01',
    })

    await deleteAssetValuation(9)
    expect(apiClient.delete).toHaveBeenCalledWith('/api/asset-valuations/9')
  })

  it('couponSchedulesApi calls correct endpoints', async () => {
    await fetchCouponSchedules({ accountId: 2 })
    expect(apiClient.get).toHaveBeenCalledWith('/api/coupon-schedules?accountId=2')

    await createCouponSchedule({
      accountId: 2,
      instrumentId: 7,
      scheduleType: 'coupon',
      amount: 50,
      currency: 'PLN',
      date: '2026-06-01',
    })
    expect(apiClient.post).toHaveBeenCalledWith('/api/coupon-schedules', {
      accountId: 2,
      instrumentId: 7,
      scheduleType: 'coupon',
      amount: 50,
      currency: 'PLN',
      date: '2026-06-01',
    })

    await recordCouponScheduleIncome(4)
    expect(apiClient.post).toHaveBeenCalledWith('/api/coupon-schedules/4/record-income', {})

    await deleteCouponSchedule(4)
    expect(apiClient.delete).toHaveBeenCalledWith('/api/coupon-schedules/4')
  })

  it('categorizationRulesApi calls correct endpoints', async () => {
    await fetchCategorizationRules()
    expect(apiClient.get).toHaveBeenCalledWith('/api/categorization-rules')

    await createCategorizationRule({ categoryId: 2, pattern: 'SHOP', matchType: 'contains' })
    expect(apiClient.post).toHaveBeenCalledWith('/api/categorization-rules', {
      categoryId: 2,
      pattern: 'SHOP',
      matchType: 'contains',
    })

    await deleteCategorizationRule(5)
    expect(apiClient.delete).toHaveBeenCalledWith('/api/categorization-rules/5')
  })

  it('budgetAlerts and automation APIs call correct endpoints', async () => {
    await fetchBudgetAlerts('2026-06', 'PLN')
    expect(apiClient.get).toHaveBeenCalledWith('/api/budgets/alerts?month=2026-06&currency=PLN')

    await fetchAccountSyncSettings()
    expect(apiClient.get).toHaveBeenCalledWith('/api/account-sync')

    await upsertAccountSyncSetting(3, { syncEnabled: true })
    expect(apiClient.put).toHaveBeenCalledWith('/api/account-sync/3', { syncEnabled: true })

    await runAccountSync(3)
    expect(apiClient.post).toHaveBeenCalledWith('/api/account-sync/3/run', {})

    await fetchBankConnections()
    expect(apiClient.get).toHaveBeenCalledWith('/api/bank-connections')

    await createBankConnection({ accountId: 1, bankCode: 'MBANK' })
    expect(apiClient.post).toHaveBeenCalledWith('/api/bank-connections', {
      accountId: 1,
      bankCode: 'MBANK',
    })

    await authorizeBankConnection(2)
    expect(apiClient.post).toHaveBeenCalledWith('/api/bank-connections/2/authorize', {})

    await fetchFullExport()
    expect(apiClient.get).toHaveBeenCalledWith('/api/export/full?format=json')

    await fetchAuditLogs({ entityType: 'transaction', limit: 10 })
    expect(apiClient.get).toHaveBeenCalledWith('/api/audit-logs?entityType=transaction&limit=10')
  })

  it('covers delete/update exports on domain API clients', async () => {
    await updatePropertyCashFlow(1, { amount: 100 })
    expect(apiClient.put).toHaveBeenCalledWith('/api/property-cash-flows/1', { amount: 100 })

    await deleteImportPreset(2)
    expect(apiClient.delete).toHaveBeenCalledWith('/api/import/presets/2')

    await deletePropertySale(3)
    expect(apiClient.delete).toHaveBeenCalledWith('/api/property-sales/3')

    await deleteTaxLossCarryforward(4)
    expect(apiClient.delete).toHaveBeenCalledWith('/api/tax-loss-carryforward/4')

    await deleteDocumentAttachment(5)
    expect(apiClient.delete).toHaveBeenCalledWith('/api/document-attachments/5')

    await updateCategorizationRule(7, { active: false })
    expect(apiClient.put).toHaveBeenCalledWith('/api/categorization-rules/7', { active: false })

    await deleteBankConnection(6)
    expect(apiClient.delete).toHaveBeenCalledWith('/api/bank-connections/6')
  })
})
