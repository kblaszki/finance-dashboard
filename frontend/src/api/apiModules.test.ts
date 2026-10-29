import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    getBlob: vi.fn(),
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
  fetchAccountBalanceHistory,
  updateAccount,
  deleteAccount,
} from './accountsApi'
import {
  fetchTransactions,
  createTransaction,
  deleteTransaction,
  updateTransaction,
  exportTransactionsCsv,
  importTransactionsCsv,
  previewTransactionsImport,
  previewImportColumns,
  applyImportColumnMapping,
  commitImportColumnMapping,
  fetchImportPresets,
  createImportPreset,
  updateImportPreset,
  deleteImportPreset,
} from './transactionsApi'
import {
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  exportCategoriesCsv,
  previewCategoriesImport,
  importCategoriesCsv,
} from './categoriesApi'
import {
  fetchTags,
  createTag,
  updateTag,
  deleteTag,
} from './tagsApi'
import {
  fetchCategoryDescriptionRules,
  createCategoryDescriptionRule,
  updateCategoryDescriptionRule,
  deleteCategoryDescriptionRule,
} from './categoryDescriptionRulesApi'
import {
  fetchCategoryBreakdown,
  fetchPeriodSummary,
  fetchTagBreakdown,
  fetchCashflowHistory,
  fetchNetWorth,
  fetchNetWorthHistory,
  fetchCashflowRolling12m,
} from './statisticsApi'
import {
  fetchTransfers,
  createTransfer,
  updateTransfer,
  deleteTransfer,
  exportTransfersCsv,
  previewTransfersImport,
  importTransfersCsv,
} from './transfersApi'

describe('API modules', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockResolvedValue({})
    vi.mocked(apiClient.post).mockResolvedValue({ token: 't', user: {} })
    vi.mocked(apiClient.put).mockResolvedValue({})
    vi.mocked(apiClient.patch).mockResolvedValue({})
    vi.mocked(apiClient.delete).mockResolvedValue(undefined)
    vi.mocked(apiClient.getBlob).mockResolvedValue(new Blob(['csv']))
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

    await fetchAccountBalanceHistory(7, { month: '2026-01', months: 6 })
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/accounts/7/balance-history?month=2026-01&months=6',
    )

    await fetchAccountBalanceHistory(7)
    expect(apiClient.get).toHaveBeenCalledWith('/api/accounts/7/balance-history')

    await updateAccount(7, { name: 'Renamed', description: null })
    expect(apiClient.patch).toHaveBeenCalledWith('/api/accounts/7', {
      name: 'Renamed',
      description: null,
    })

    await deleteAccount(7)
    expect(apiClient.delete).toHaveBeenCalledWith('/api/accounts/7')
  })

  it('transactionsApi calls correct endpoints', async () => {
    await fetchTransactions(3, { month: '2026-03' })
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/accounts/3/transactions?month=2026-03',
    )

    await createTransaction(3, {
      type: 'INCOME',
      amount: 12.5,
      description: 'Pay',
      categoryId: 4,
      tagIds: [1, 2],
    })
    expect(apiClient.post).toHaveBeenCalledWith('/api/accounts/3/transactions', {
      type: 'INCOME',
      amount: 12.5,
      description: 'Pay',
      categoryId: 4,
      tagIds: [1, 2],
    })

    await deleteTransaction(3, 9)
    expect(apiClient.delete).toHaveBeenCalledWith('/api/accounts/3/transactions/9')

    await updateTransaction(3, 9, { amount: 4, type: 'EXPENSE', tagIds: [] })
    expect(apiClient.patch).toHaveBeenCalledWith('/api/accounts/3/transactions/9', {
      amount: 4,
      type: 'EXPENSE',
      tagIds: [],
    })

    await exportTransactionsCsv(3)
    expect(apiClient.getBlob).toHaveBeenCalledWith(
      '/api/accounts/3/transactions/export',
    )

    await previewTransactionsImport(3, 'id,type\n')
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/accounts/3/transactions/import/preview',
      { csv: 'id,type\n' },
    )

    await importTransactionsCsv(3, 'id,type\n', [])
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/accounts/3/transactions/import',
      { csv: 'id,type\n', categoryMappings: [], descriptionMappings: [] },
    )

    await previewImportColumns(3, 'Date,Amount\n')
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/accounts/3/transactions/import/columns/preview',
      { csv: 'Date,Amount\n' },
    )

    const columnMapping = {
      occurredAt: 0,
      amount: 1,
      amountSignMode: 'negativeIsExpense' as const,
    }
    await applyImportColumnMapping(3, 'Date,Amount\n', columnMapping)
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/accounts/3/transactions/import/columns/apply',
      { csv: 'Date,Amount\n', columnMapping },
    )

    await commitImportColumnMapping(3, 'Date,Amount\n', columnMapping, [])
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/accounts/3/transactions/import/columns/commit',
      {
        csv: 'Date,Amount\n',
        columnMapping,
        categoryMappings: [],
        descriptionMappings: [],
      },
    )

    await fetchImportPresets(3)
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/accounts/3/import-presets',
    )

    await createImportPreset(3, {
      name: 'Bank',
      headers: ['Date', 'Amount'],
      columnMapping,
    })
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/accounts/3/import-presets',
      {
        name: 'Bank',
        headers: ['Date', 'Amount'],
        columnMapping,
      },
    )

    await updateImportPreset(3, 9, { name: 'Card' })
    expect(apiClient.patch).toHaveBeenCalledWith(
      '/api/accounts/3/import-presets/9',
      { name: 'Card' },
    )

    await deleteImportPreset(3, 9)
    expect(apiClient.delete).toHaveBeenCalledWith(
      '/api/accounts/3/import-presets/9',
    )
  })

  it('categoryDescriptionRulesApi calls correct endpoints', async () => {
    await fetchCategoryDescriptionRules()
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/category-description-rules',
    )

    await createCategoryDescriptionRule({
      pattern: 'zabka',
      ledgerType: 'EXPENSE',
      categoryId: 2,
    })
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/category-description-rules',
      { pattern: 'zabka', ledgerType: 'EXPENSE', categoryId: 2 },
    )

    await updateCategoryDescriptionRule(5, { pattern: 'uber' })
    expect(apiClient.patch).toHaveBeenCalledWith(
      '/api/category-description-rules/5',
      { pattern: 'uber' },
    )

    await deleteCategoryDescriptionRule(5)
    expect(apiClient.delete).toHaveBeenCalledWith(
      '/api/category-description-rules/5',
    )
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

    await exportCategoriesCsv()
    expect(apiClient.getBlob).toHaveBeenCalledWith('/api/categories/export')

    await previewCategoriesImport('csv-body')
    expect(apiClient.post).toHaveBeenCalledWith('/api/categories/import/preview', {
      csv: 'csv-body',
    })

    await importCategoriesCsv('csv-body')
    expect(apiClient.post).toHaveBeenCalledWith('/api/categories/import', {
      csv: 'csv-body',
    })
  })

  it('tagsApi calls correct endpoints', async () => {
    await fetchTags()
    expect(apiClient.get).toHaveBeenCalledWith('/api/tags')

    await createTag({ name: 'Work' })
    expect(apiClient.post).toHaveBeenCalledWith('/api/tags', { name: 'Work' })

    await updateTag(2, { name: 'Office' })
    expect(apiClient.patch).toHaveBeenCalledWith('/api/tags/2', { name: 'Office' })

    await deleteTag(2)
    expect(apiClient.delete).toHaveBeenCalledWith('/api/tags/2')
  })

  it('statisticsApi calls correct endpoints', async () => {
    await fetchCategoryBreakdown('2026-08')
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/statistics/category-breakdown?month=2026-08',
    )

    await fetchCategoryBreakdown('2026-02', 'quarter')
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/statistics/category-breakdown?month=2026-02&period=quarter',
    )

    await fetchPeriodSummary('2026-08', 'PLN')
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/statistics/period-summary?month=2026-08&currency=PLN',
    )

    await fetchTagBreakdown('2026-08', 'PLN', 'year')
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/statistics/tag-breakdown?month=2026-08&currency=PLN&period=year',
    )

    await fetchCashflowHistory('2026-01', 'EUR', 6)
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/statistics/cashflow-history?month=2026-01&currency=EUR&months=6',
    )

    await fetchNetWorth('PLN')
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/statistics/net-worth?currency=PLN',
    )

    await fetchNetWorthHistory('EUR', 24, '2026-10')
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/statistics/net-worth-history?currency=EUR&months=24&month=2026-10',
    )

    await fetchCashflowRolling12m('USD')
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/statistics/cashflow-rolling-12m?currency=USD',
    )
  })

  it('transfersApi calls correct endpoints', async () => {
    await fetchTransfers({ limit: 50 })
    expect(apiClient.get).toHaveBeenCalledWith('/api/transfers?limit=50')

    await createTransfer({
      fromAccountId: 1,
      toAccountId: 2,
      amountFrom: 100,
      amountTo: 25,
      description: 'FX move',
      categoryId: 10,
    })
    expect(apiClient.post).toHaveBeenCalledWith('/api/transfers', {
      fromAccountId: 1,
      toAccountId: 2,
      amountFrom: 100,
      amountTo: 25,
      description: 'FX move',
      categoryId: 10,
    })

    await updateTransfer(9, { amountFrom: 50, categoryId: null })
    expect(apiClient.patch).toHaveBeenCalledWith('/api/transfers/9', {
      amountFrom: 50,
      categoryId: null,
    })

    await deleteTransfer(9)
    expect(apiClient.delete).toHaveBeenCalledWith('/api/transfers/9')

    await exportTransfersCsv()
    expect(apiClient.getBlob).toHaveBeenCalledWith('/api/transfers/export')

    await previewTransfersImport('csv-body')
    expect(apiClient.post).toHaveBeenCalledWith('/api/transfers/import/preview', {
      csv: 'csv-body',
    })

    await previewTransfersImport('csv-body', [
      { name: 'A', currency: 'PLN', accountId: 1 },
    ])
    expect(apiClient.post).toHaveBeenCalledWith('/api/transfers/import/preview', {
      csv: 'csv-body',
      accountMappings: [{ name: 'A', currency: 'PLN', accountId: 1 }],
    })

    await importTransfersCsv(
      'csv-body',
      [{ name: 'A', currency: 'PLN', accountId: 1 }],
      [2],
    )
    expect(apiClient.post).toHaveBeenCalledWith('/api/transfers/import', {
      csv: 'csv-body',
      accountMappings: [{ name: 'A', currency: 'PLN', accountId: 1 }],
      skipRows: [2],
    })
  })
})
