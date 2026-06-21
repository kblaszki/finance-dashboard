import type { Account } from '../accountsApi'
import type { Transaction } from '../transactionsApi'
import type { CashflowStats } from '../statsApi'

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

export function validateApiContractFixtures(): void {
  assertAccountShape(accountFixture)
  assertTransactionShape(transactionFixture)
  assertCashflowShape(cashflowFixture)
}
