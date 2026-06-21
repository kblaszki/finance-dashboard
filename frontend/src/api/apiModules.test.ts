import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  setAuthToken: vi.fn(),
}))

import { apiClient } from './client'
import { register, login, fetchMe } from './authApi'
import {
  fetchAccounts,
  fetchAccount,
  createAccount,
  updateAccount,
  deleteAccount,
  fetchAccountValuations,
} from './accountsApi'
import {
  fetchTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from './transactionsApi'
import {
  fetchAccountHoldings,
  fetchHolding,
  createHolding,
} from './holdingsApi'
import {
  fetchHoldingLots,
  createHoldingLot,
  deleteHoldingLot,
} from './holdingLotsApi'
import {
  fetchInstruments,
  createInstrument,
  fetchInstrumentValuations,
  createInstrumentValuation,
} from './instrumentsApi'
import { fetchHoldingValuations } from './valuationsApi'
import {
  fetchNetWorth,
  fetchCashflow,
  fetchExpensesByCategory,
  fetchIncomeByCategory,
} from './statsApi'
import { fetchMarketDataStatus, triggerMarketSync } from './marketDataApi'

describe('API modules', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockResolvedValue({})
    vi.mocked(apiClient.post).mockResolvedValue({ token: 't', user: {} })
    vi.mocked(apiClient.put).mockResolvedValue({})
    vi.mocked(apiClient.delete).mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('authApi calls correct endpoints', async () => {
    await register('a@b.c', 'user', 'pass')
    expect(apiClient.post).toHaveBeenCalledWith('/api/auth/register', {
      email: 'a@b.c',
      username: 'user',
      password: 'pass',
    })

    await login('a@b.c', 'pass')
    expect(apiClient.post).toHaveBeenCalledWith('/api/auth/login', {
      email: 'a@b.c',
      password: 'pass',
    })

    await fetchMe()
    expect(apiClient.get).toHaveBeenCalledWith('/api/auth/me')
  })

  it('accountsApi calls correct endpoints', async () => {
    await fetchAccounts()
    expect(apiClient.get).toHaveBeenCalledWith('/api/accounts')

    await fetchAccount(3)
    expect(apiClient.get).toHaveBeenCalledWith('/api/accounts/3')

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

    await createHolding(2, 11)
    expect(apiClient.post).toHaveBeenCalledWith('/api/accounts/2/holdings', {
      instrumentId: 11,
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

    await fetchCashflow({ from: '2025-01-01', to: '2025-01-31', currency: 'PLN' })
    expect(apiClient.get).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/stats\/cashflow\?/),
    )
    expect(apiClient.get).toHaveBeenCalledWith(
      expect.stringMatching(/from=2025-01-01/),
    )

    await fetchExpensesByCategory({ from: '2025-01-01', to: '2025-01-31' })
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/stats/expenses-by-category?from=2025-01-01&to=2025-01-31',
    )

    await fetchIncomeByCategory({ from: '2025-01-01', to: '2025-01-31' })
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/stats/income-by-category?from=2025-01-01&to=2025-01-31',
    )
  })

  it('marketDataApi calls correct endpoints', async () => {
    await fetchMarketDataStatus()
    expect(apiClient.get).toHaveBeenCalledWith('/api/market-data/status')

    await triggerMarketSync()
    expect(apiClient.post).toHaveBeenCalledWith('/api/market-data/sync', {})

    await triggerMarketSync(30)
    expect(apiClient.post).toHaveBeenCalledWith('/api/market-data/sync', { backfillDays: 30 })
  })
})
