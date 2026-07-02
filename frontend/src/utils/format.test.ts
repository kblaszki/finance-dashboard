import { describe, expect, it } from 'vitest'
import { formatMoney, formatPercent } from './format'

describe('formatMoney', () => {
  it('formats PLN amounts with en-US locale', () => {
    expect(formatMoney(1234.5, 'PLN', 'en-US')).toBe('PLN\u00a01,234.50')
  })

  it('falls back when currency code is invalid', () => {
    expect(formatMoney(10, 'NOT_A_CURRENCY')).toBe('10.00 NOT_A_CURRENCY')
  })

  it('treats non-finite values as zero', () => {
    expect(formatMoney(Number.NaN, 'USD')).toMatch(/0\.00/)
    expect(formatMoney(Number.POSITIVE_INFINITY, 'USD')).toMatch(/0\.00/)
  })

  it('uses default locale and empty currency fallback', () => {
    expect(formatMoney(10, 'NOT_A_CURRENCY')).toBe('10.00 NOT_A_CURRENCY')
    expect(formatMoney(5, 'PLN')).toMatch(/5\.00/)
  })
})

describe('formatPercent', () => {
  it('formats finite values with default decimals', () => {
    expect(formatPercent(12.345)).toBe('12.35%')
  })

  it('supports signed positive values', () => {
    expect(formatPercent(5.2, { signed: true })).toBe('+5.20%')
    expect(formatPercent(-3.1, { signed: true })).toBe('-3.10%')
  })

  it('returns em dash for null and non-finite values', () => {
    expect(formatPercent(null)).toBe('—')
    expect(formatPercent(Number.NaN)).toBe('—')
  })
})
