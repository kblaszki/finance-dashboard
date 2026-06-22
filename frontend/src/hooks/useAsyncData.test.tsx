import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useAsyncData } from './useAsyncData'

describe('useAsyncData', () => {
  it('loads data and exposes reload', async () => {
    let calls = 0
    const loader = vi.fn(async () => {
      calls += 1
      return { value: calls }
    })

    const { result } = renderHook(() => useAsyncData(loader))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data).toEqual({ value: 1 })
    expect(result.current.error).toBeNull()

    result.current.reload()

    await waitFor(() => {
      expect(result.current.data).toEqual({ value: 2 })
    })
  })

  it('captures loader errors', async () => {
    const loader = vi.fn(async () => {
      throw new Error('boom')
    })

    const { result } = renderHook(() => useAsyncData(loader))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data).toBeNull()
    expect(result.current.error).toBe('boom')
  })
})
