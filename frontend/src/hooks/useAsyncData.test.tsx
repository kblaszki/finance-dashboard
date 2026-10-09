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

  it('maps non-Error rejections to a generic message', async () => {
    const loader = vi.fn(async () => {
      throw 'nope'
    })

    const { result } = renderHook(() => useAsyncData(loader))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('Failed to load')
  })

  it('keeps loading false on reload when data already exists', async () => {
    let resolveNext: ((value: { value: number }) => void) | null = null
    let calls = 0
    const loader = vi.fn(
      () =>
        new Promise<{ value: number }>((resolve) => {
          calls += 1
          if (calls === 1) {
            resolve({ value: 1 })
            return
          }
          resolveNext = resolve
        }),
    )

    const { result } = renderHook(() => useAsyncData(loader))

    await waitFor(() => {
      expect(result.current.data).toEqual({ value: 1 })
      expect(result.current.loading).toBe(false)
    })

    result.current.reload()

    await waitFor(() => {
      expect(loader).toHaveBeenCalledTimes(2)
    })
    expect(result.current.loading).toBe(false)
    expect(result.current.data).toEqual({ value: 1 })

    resolveNext?.({ value: 2 })
    await waitFor(() => {
      expect(result.current.data).toEqual({ value: 2 })
    })
  })

  it('keeps previous data when a reload fails', async () => {
    let fail = false
    const loader = vi.fn(async () => {
      if (fail) throw new Error('reload failed')
      return { value: 1 }
    })

    const { result } = renderHook(() => useAsyncData(loader))

    await waitFor(() => {
      expect(result.current.data).toEqual({ value: 1 })
    })

    fail = true
    result.current.reload()

    await waitFor(() => {
      expect(result.current.error).toBe('reload failed')
    })

    expect(result.current.data).toEqual({ value: 1 })
    expect(result.current.loading).toBe(false)
  })
})
