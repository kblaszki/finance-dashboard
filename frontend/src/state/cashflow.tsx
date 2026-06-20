import { createContext, useContext, type ReactNode } from 'react'
import { fetchCashflow } from '../api/statsApi'
import { useAsyncData } from '../hooks/useAsyncData'
import { useCurrency } from './currency'
import { usePeriod } from './period'

type CashflowStats = Awaited<ReturnType<typeof fetchCashflow>>

type CashFlowContextValue = {
  stats: CashflowStats | null
  error: string | null
  loading: boolean
  reload: () => void
}

const CashFlowContext = createContext<CashFlowContextValue | null>(null)

export function CashFlowProvider({ children }: { children: ReactNode }) {
  const { currency } = useCurrency()
  const { range } = usePeriod()
  const { data, error, loading, reload } = useAsyncData(
    () => fetchCashflow({ from: range.from, to: range.to, currency }),
    [currency, range.from, range.to],
  )

  return (
    <CashFlowContext.Provider value={{ stats: data, error, loading, reload }}>
      {children}
    </CashFlowContext.Provider>
  )
}

export function useCashFlow(): CashFlowContextValue {
  const value = useContext(CashFlowContext)
  if (!value) {
    throw new Error('useCashFlow must be used within CashFlowProvider')
  }
  return value
}
