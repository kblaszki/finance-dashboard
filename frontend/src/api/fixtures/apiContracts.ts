import type { Account } from '../accountsApi'
import type { Transaction } from '../transactionsApi'
import type { CashflowStats, CategoryAmount, NetWorthStats } from '../statsApi'

/** Sample shapes produced by backend serializers in routeSupport.ts / statsRoutes.ts */
export const accountFixture: Account = {
  id: 1,
  accountType: 'BANK',
  name: 'Main',
  currency: 'PLN',
  cashBalance: 1500.5,
  openingBalance: 1000,
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
  accounts: [
    { id: 1, name: 'Bank', accountType: 'BANK', value: 5000 },
    { id: 2, name: 'Broker', accountType: 'BROKERAGE', value: 7000 },
  ],
}

export const categoryAmountFixture: CategoryAmount[] = [
  { category: 'FOOD', amount: 120.5 },
  { category: 'TRAVEL', amount: 80 },
]

function assertAccountShape(value: Account): void {
  if (typeof value.id !== 'number') throw new Error('account.id')
  if (!['BANK', 'BROKERAGE', 'MANUAL'].includes(value.accountType)) throw new Error('account.accountType')
  if (typeof value.cashBalance !== 'number') throw new Error('account.cashBalance')
  if (typeof value.openingBalance !== 'number') throw new Error('account.openingBalance')
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
  if (!Array.isArray(value.accounts)) throw new Error('netWorth.accounts')
}

function assertCategoryAmountsShape(value: CategoryAmount[]): void {
  for (const row of value) {
    if (typeof row.category !== 'string') throw new Error('categoryAmount.category')
    if (typeof row.amount !== 'number') throw new Error('categoryAmount.amount')
  }
}

export function validateApiContractFixtures(): void {
  assertAccountShape(accountFixture)
  assertTransactionShape(transactionFixture)
  assertCashflowShape(cashflowFixture)
  assertNetWorthShape(netWorthFixture)
  assertCategoryAmountsShape(categoryAmountFixture)
}
