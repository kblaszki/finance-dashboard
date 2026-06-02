import { createContext, useContext, useMemo, useState } from 'react'

type PortfolioContextValue = {
  activePortfolioId: number | null
  setActivePortfolioId: (id: number | null) => void
}

const PortfolioContext = createContext<PortfolioContextValue | null>(null)

export function PortfolioProvider(props: { children: React.ReactNode }) {
  const [activePortfolioId, setActivePortfolioId] = useState<number | null>(null)
  const value = useMemo(() => ({ activePortfolioId, setActivePortfolioId }), [activePortfolioId])
  return <PortfolioContext.Provider value={value}>{props.children}</PortfolioContext.Provider>
}

export function useActivePortfolio() {
  const ctx = useContext(PortfolioContext)
  if (!ctx) throw new Error('useActivePortfolio must be used within PortfolioProvider')
  return ctx
}

