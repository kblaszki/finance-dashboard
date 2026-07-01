import { describe, expect, it } from 'vitest'
import { formatMoney } from './format'

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
