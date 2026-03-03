import { createContext, useContext, useEffect, useMemo, useState } from 'react'

export const SUPPORTED_CURRENCIES = [
  'PLN',
  'EUR',
  'USD',
  'GBP',
  'CHF',
  'JPY',
  'CZK',
  'NOK',
  'SEK',
] as const

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number]

type CurrencyContextValue = {
  currency: SupportedCurrency
  setCurrency: (c: SupportedCurrency) => void
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null)

const STORAGE_KEY = 'finance-dashboard:currency'

function isSupportedCurrency(value: string): value is SupportedCurrency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(value)
}

export function CurrencyProvider(props: { children: React.ReactNode }) {
  const [currency, setCurrency] = useState<SupportedCurrency>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && isSupportedCurrency(saved)) return saved
    return 'PLN'
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, currency)
  }, [currency])

  const value = useMemo(() => ({ currency, setCurrency }), [currency])

  return <CurrencyContext.Provider value={value}>{props.children}</CurrencyContext.Provider>
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext)
  if (!ctx) {
    throw new Error('useCurrency must be used within CurrencyProvider')
  }
  return ctx
}

