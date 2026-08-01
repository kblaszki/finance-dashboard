import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  STORAGE_KEY,
  ThemeProvider,
  useTheme,
  type ThemePreference,
} from './theme'

type MediaListener = (event: MediaQueryListEvent) => void

function mockMatchMedia(initialDark: boolean) {
  let matches = initialDark
  const listeners = new Set<MediaListener>()

  const mql = {
    get matches() {
      return matches
    },
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: (_type: string, listener: EventListener) => {
      listeners.add(listener as MediaListener)
    },
    removeEventListener: (_type: string, listener: EventListener) => {
      listeners.delete(listener as MediaListener)
    },
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
    setMatches(next: boolean) {
      matches = next
      const event = { matches: next } as MediaQueryListEvent
      listeners.forEach((listener) => listener(event))
    },
  }

  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => mql),
  )

  return mql
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
    localStorage.clear()
  })

  it('uses stored dark preference and sets data-theme', async () => {
    localStorage.setItem(STORAGE_KEY, 'dark')
    mockMatchMedia(false)

    const { result } = renderHook(() => useTheme(), { wrapper })

    expect(result.current.preference).toBe('dark')
    expect(result.current.theme).toBe('dark')
    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('dark')
    })
  })

  it('follows system preference and updates when media changes', async () => {
    localStorage.setItem(STORAGE_KEY, 'system')
    const mql = mockMatchMedia(true)

    const { result } = renderHook(() => useTheme(), { wrapper })

    expect(result.current.preference).toBe('system')
    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')

    act(() => {
      mql.setMatches(false)
    })

    await waitFor(() => {
      expect(result.current.theme).toBe('light')
      expect(document.documentElement.dataset.theme).toBe('light')
    })
  })

  it('setPreference(light) persists and stops following media', async () => {
    localStorage.setItem(STORAGE_KEY, 'system')
    const mql = mockMatchMedia(true)

    const { result } = renderHook(() => useTheme(), { wrapper })

    act(() => {
      result.current.setPreference('light')
    })

    await waitFor(() => {
      expect(result.current.preference).toBe('light')
      expect(result.current.theme).toBe('light')
      expect(localStorage.getItem(STORAGE_KEY)).toBe('light')
      expect(document.documentElement.dataset.theme).toBe('light')
    })

    act(() => {
      mql.setMatches(true)
    })

    expect(result.current.theme).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('cycles preference light → dark → system', async () => {
    localStorage.setItem(STORAGE_KEY, 'light')
    mockMatchMedia(false)

    const { result } = renderHook(() => useTheme(), { wrapper })
    const order: ThemePreference[] = []

    expect(result.current.preference).toBe('light')

    act(() => {
      result.current.cyclePreference()
    })
    order.push(result.current.preference)

    act(() => {
      result.current.cyclePreference()
    })
    order.push(result.current.preference)

    act(() => {
      result.current.cyclePreference()
    })
    order.push(result.current.preference)

    expect(order).toEqual(['dark', 'system', 'light'])
    await waitFor(() => {
      expect(localStorage.getItem(STORAGE_KEY)).toBe('light')
    })
  })

  it('defaults missing storage to system', () => {
    mockMatchMedia(true)

    const { result } = renderHook(() => useTheme(), { wrapper })

    expect(result.current.preference).toBe('system')
    expect(result.current.theme).toBe('dark')
  })
})
