import { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

type ThemeContextValue = {
  preference: ThemePreference
  theme: ResolvedTheme
  setPreference: (preference: ThemePreference) => void
  cyclePreference: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export const STORAGE_KEY = 'finance-dashboard:theme'

const PREFERENCE_ORDER: ThemePreference[] = ['light', 'dark', 'system']

export function readStoredPreference(): ThemePreference {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'light' || saved === 'dark' || saved === 'system') return saved
  return 'system'
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'light' || preference === 'dark') return preference
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(theme: ResolvedTheme) {
  document.documentElement.dataset.theme = theme
}

function nextPreference(current: ThemePreference): ThemePreference {
  const idx = PREFERENCE_ORDER.indexOf(current)
  return PREFERENCE_ORDER[(idx + 1) % PREFERENCE_ORDER.length]
}

export function ThemeProvider(props: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    const initial = readStoredPreference()
    applyTheme(resolveTheme(initial))
    return initial
  })
  const [theme, setThemeState] = useState<ResolvedTheme>(() =>
    resolveTheme(readStoredPreference()),
  )

  useEffect(() => {
    const resolved = resolveTheme(preference)
    setThemeState(resolved)
    applyTheme(resolved)
    localStorage.setItem(STORAGE_KEY, preference)
  }, [preference])

  useEffect(() => {
    if (preference !== 'system') return

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      const resolved = resolveTheme('system')
      setThemeState(resolved)
      applyTheme(resolved)
    }

    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [preference])

  const setPreference = (next: ThemePreference) => setPreferenceState(next)
  const cyclePreference = () => setPreferenceState((p) => nextPreference(p))

  const value = useMemo(
    () => ({ preference, theme, setPreference, cyclePreference }),
    [preference, theme],
  )

  return <ThemeContext.Provider value={value}>{props.children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return ctx
}
