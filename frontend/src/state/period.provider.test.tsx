import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { PeriodProvider, usePeriod, usePeriodOptional } from './period'

function wrapper(initialPreset?: Parameters<typeof PeriodProvider>[0]['initialPreset']) {
  return function PeriodWrapper({ children }: { children: ReactNode }) {
    return <PeriodProvider initialPreset={initialPreset}>{children}</PeriodProvider>
  }
}

describe('PeriodProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-15T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('exposes preset range and yearMonth', () => {
    const { result } = renderHook(() => usePeriod(), { wrapper: wrapper('current_month') })
    expect(result.current.preset).toBe('current_month')
    expect(result.current.range).toEqual({ from: '2026-03-01', to: '2026-03-31' })
    expect(result.current.yearMonth).toBe('2026-03')
  })

  it('updates range when preset changes', () => {
    const { result } = renderHook(() => usePeriod(), { wrapper: wrapper('current_month') })
    act(() => {
      result.current.setPreset('prev_month')
    })
    expect(result.current.preset).toBe('prev_month')
    expect(result.current.range).toEqual({ from: '2026-02-01', to: '2026-02-28' })
  })

  it('uses custom range when setCustomRange is called', () => {
    const { result } = renderHook(() => usePeriod(), { wrapper: wrapper('current_month') })
    act(() => {
      result.current.setCustomRange({ from: '2026-01-10', to: '2026-01-20' })
    })
    expect(result.current.preset).toBe('custom')
    expect(result.current.range).toEqual({ from: '2026-01-10', to: '2026-01-20' })
  })

  it('throws when usePeriod is used outside provider', () => {
    expect(() => renderHook(() => usePeriod())).toThrow(/PeriodProvider/)
  })

  it('returns null from usePeriodOptional outside provider', () => {
    const { result } = renderHook(() => usePeriodOptional())
    expect(result.current).toBeNull()
  })
})
