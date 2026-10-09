import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureTestLocalStorage } from '../test/setup'
import { STORAGE_KEY, ThemeProvider, useTheme } from './theme'

function mockMatchMedia(dark: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: dark,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })),
  )
}

function wrapper(props: { children: React.ReactNode }) {
  return <ThemeProvider>{props.children}</ThemeProvider>
}

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    ensureTestLocalStorage()
    localStorage.clear()
  })

  it('uses stored dark theme and sets data-theme', async () => {
    localStorage.setItem(STORAGE_KEY, 'dark')
    mockMatchMedia(false)

    const { result } = renderHook(() => useTheme(), { wrapper })

    expect(result.current.theme).toBe('dark')
    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('dark')
      expect(localStorage.getItem(STORAGE_KEY)).toBe('dark')
    })
  })

  it('toggles light ↔ dark', async () => {
    localStorage.setItem(STORAGE_KEY, 'light')
    mockMatchMedia(false)

    const { result } = renderHook(() => useTheme(), { wrapper })

    act(() => {
      result.current.toggleTheme()
    })

    await waitFor(() => {
      expect(result.current.theme).toBe('dark')
      expect(localStorage.getItem(STORAGE_KEY)).toBe('dark')
    })

    act(() => {
      result.current.toggleTheme()
    })

    await waitFor(() => {
      expect(result.current.theme).toBe('light')
    })
  })

  it('migrates legacy system storage via one-shot OS preference', async () => {
    localStorage.setItem(STORAGE_KEY, 'system')
    mockMatchMedia(true)

    const { result } = renderHook(() => useTheme(), { wrapper })

    expect(result.current.theme).toBe('dark')
    await waitFor(() => {
      expect(localStorage.getItem(STORAGE_KEY)).toBe('dark')
      expect(document.documentElement.dataset.theme).toBe('dark')
    })
  })

  it('defaults missing storage from OS preference', () => {
    mockMatchMedia(false)

    const { result } = renderHook(() => useTheme(), { wrapper })

    expect(result.current.theme).toBe('light')
  })

  it('setTheme persists explicit choice', async () => {
    localStorage.setItem(STORAGE_KEY, 'light')
    mockMatchMedia(true)

    const { result } = renderHook(() => useTheme(), { wrapper })

    act(() => {
      result.current.setTheme('dark')
    })

    await waitFor(() => {
      expect(result.current.theme).toBe('dark')
      expect(localStorage.getItem(STORAGE_KEY)).toBe('dark')
    })
  })
})
