import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { rangeForPreset } from './period'

describe('rangeForPreset', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-15T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns current month range', () => {
    expect(rangeForPreset('current_month')).toEqual({
      from: '2025-06-01',
      to: '2025-06-30',
    })
  })

  it('returns previous month range', () => {
    expect(rangeForPreset('prev_month')).toEqual({
      from: '2025-05-01',
      to: '2025-05-31',
    })
  })

  it('returns current quarter range', () => {
    expect(rangeForPreset('current_quarter')).toEqual({
      from: '2025-04-01',
      to: '2025-06-30',
    })
  })

  it('returns current year range', () => {
    expect(rangeForPreset('current_year')).toEqual({
      from: '2025-01-01',
      to: '2025-12-31',
    })
  })

  it('falls back to current month for custom preset', () => {
    expect(rangeForPreset('custom')).toEqual({
      from: '2025-06-01',
      to: '2025-06-30',
    })
  })
})
