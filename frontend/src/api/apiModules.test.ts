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
import {
  register,
  login,
  fetchMe,
  logoutLocal,
  fetchAuthConfig,
  updateProfile,
  updatePassword,
  updateEmail,
} from './authApi'
import {
  fetchAccounts,
  createAccount,
  fetchAccount,
  updateAccount,
  deleteAccount,
} from './accountsApi'
import {
  fetchTransactions,
  createTransaction,
  deleteTransaction,
} from './transactionsApi'
import {
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from './categoriesApi'
import {
  fetchCategoryBreakdown,
  fetchPeriodSummary,
  fetchCashflowHistory,
} from './statisticsApi'

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

    await createAccount({
      name: 'Checking',
      currency: 'PLN',
      openingBalance: 10,
      accountType: 'BANK',
    })
    expect(apiClient.post).toHaveBeenCalledWith('/api/accounts', {
      name: 'Checking',
      currency: 'PLN',
      openingBalance: 10,
      accountType: 'BANK',
    })

    await fetchAccount(7)
    expect(apiClient.get).toHaveBeenCalledWith('/api/accounts/7')

    await updateAccount(7, { name: 'Renamed', description: null })
    expect(apiClient.patch).toHaveBeenCalledWith('/api/accounts/7', {
      name: 'Renamed',
      description: null,
    })

    await deleteAccount(7)
    expect(apiClient.delete).toHaveBeenCalledWith('/api/accounts/7')
  })

  it('transactionsApi calls correct endpoints', async () => {
    await fetchTransactions(3)
    expect(apiClient.get).toHaveBeenCalledWith('/api/accounts/3/transactions')

    await createTransaction(3, {
      type: 'INCOME',
      amount: 12.5,
      description: 'Pay',
      categoryId: 4,
    })
    expect(apiClient.post).toHaveBeenCalledWith('/api/accounts/3/transactions', {
      type: 'INCOME',
      amount: 12.5,
      description: 'Pay',
      categoryId: 4,
    })

    await deleteTransaction(3, 9)
    expect(apiClient.delete).toHaveBeenCalledWith('/api/accounts/3/transactions/9')
  })

  it('categoriesApi calls correct endpoints', async () => {
    await fetchCategories()
    expect(apiClient.get).toHaveBeenCalledWith('/api/categories')

    await createCategory({ name: 'Food', parentId: 1 })
    expect(apiClient.post).toHaveBeenCalledWith('/api/categories', {
      name: 'Food',
      parentId: 1,
    })

    await updateCategory(2, { name: 'Groceries', parentId: null })
    expect(apiClient.patch).toHaveBeenCalledWith('/api/categories/2', {
      name: 'Groceries',
      parentId: null,
    })

    await deleteCategory(2)
    expect(apiClient.delete).toHaveBeenCalledWith('/api/categories/2')
  })

  it('statisticsApi calls correct endpoints', async () => {
    await fetchCategoryBreakdown('2026-08')
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/statistics/category-breakdown?month=2026-08',
    )

    await fetchPeriodSummary('2026-08', 'PLN')
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/statistics/period-summary?month=2026-08&currency=PLN',
    )

    await fetchCashflowHistory('2026-01', 'EUR', 6)
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/statistics/cashflow-history?month=2026-01&currency=EUR&months=6',
    )
  })
})
