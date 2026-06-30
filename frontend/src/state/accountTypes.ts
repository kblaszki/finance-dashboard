export type AccountType =
  | 'BANK'
  | 'BROKERAGE'
  | 'CRYPTO'
  | 'PRECIOUS_METAL'
  | 'REAL_ESTATE'
  | 'OTHER'
  | 'MANUAL'

export const ACCOUNT_TYPE_OPTIONS: Array<{ value: AccountType; label: string }> = [
  { value: 'BANK', label: 'Bank account' },
  { value: 'BROKERAGE', label: 'Brokerage account' },
  { value: 'CRYPTO', label: 'Crypto wallet' },
  { value: 'PRECIOUS_METAL', label: 'Precious metals' },
  { value: 'REAL_ESTATE', label: 'Real estate' },
  { value: 'OTHER', label: 'Other assets' },
  { value: 'MANUAL', label: 'Manual asset (legacy)' },
]

const HOLDINGS_TYPES = new Set<AccountType>(['BROKERAGE', 'CRYPTO', 'PRECIOUS_METAL'])
const REVALUE_TYPES = new Set<AccountType>(['MANUAL', 'REAL_ESTATE', 'OTHER'])
const CHART_SPLIT_TYPES = new Set<AccountType>(['BROKERAGE', 'CRYPTO'])

export function isHoldingsAccountType(type: AccountType): boolean {
  return HOLDINGS_TYPES.has(type)
}

export function isRevalueAccountType(type: AccountType): boolean {
  return REVALUE_TYPES.has(type)
}

export function showBrokerageChartSplit(type: AccountType): boolean {
  return CHART_SPLIT_TYPES.has(type)
}

export function typeLabel(type: AccountType): string {
  return ACCOUNT_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type
}
