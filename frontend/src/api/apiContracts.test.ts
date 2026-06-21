import { describe, expect, it } from 'vitest'
import {
  accountFixture,
  cashflowFixture,
  categoryAmountFixture,
  netWorthFixture,
  transactionFixture,
  validateApiContractFixtures,
} from './fixtures/apiContracts'
import type { Account } from './accountsApi'
import type { Transaction } from './transactionsApi'
import type { CashflowStats, CategoryAmount, NetWorthStats } from './statsApi'

describe('API contract fixtures', () => {
  it('validates fixture shapes against frontend types', () => {
    expect(() => validateApiContractFixtures()).not.toThrow()
  })

  it('account fixture matches Account type fields', () => {
    const account: Account = accountFixture
    expect(account.accountType).toBe('BANK')
    expect(typeof account.cashBalance).toBe('number')
  })

  it('transaction fixture uses numeric Decimal fields from backend', () => {
    const tx: Transaction = transactionFixture
    expect(typeof tx.balanceAfter).toBe('number')
    expect(tx.date).toMatch(/T/)
  })

  it('cashflow fixture net equals income minus expense', () => {
    expect(cashflowFixture.net).toBe(cashflowFixture.income - cashflowFixture.expense)
  })

  it('net worth and category fixtures match stats types', () => {
    const netWorth: NetWorthStats = netWorthFixture
    expect(netWorth.accounts).toHaveLength(2)

    const categories: CategoryAmount[] = categoryAmountFixture
    expect(categories[0]!.category).toBe('FOOD')
  })
})
