import { useEffect, useState } from 'react'
import { apiClient } from '../../api/client'
import { Pie, PieChart, ResponsiveContainer, Tooltip, Cell } from 'recharts'
import { useCurrency } from '../../state/currency'
import { formatMoney } from '../../utils/format'

interface ExpenseByCategory {
  category: string
  amount: number
  currency?: string
  fxAsOf?: string
}

const COLORS = ['#2563eb', '#16a34a', '#f97316', '#ec4899', '#8b5cf6', '#0ea5e9']

export function ExpensesByCategoryChart() {
  const [data, setData] = useState<ExpenseByCategory[]>([])
  const { currency } = useCurrency()

  useEffect(() => {
    void load()
  }, [currency])

  async function load() {
    const response = await apiClient.get<ExpenseByCategory[]>(
      `/api/stats/expenses-by-category?currency=${encodeURIComponent(currency)}`,
    )
    setData(response)
  }

  if (!data.length) {
    return <p>Brak danych o wydatkach.</p>
  }

  return (
    <div className="card">
      <h2>Wydatki według kategorii</h2>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            dataKey="amount"
            nameKey="category"
            cx="50%"
            cy="50%"
            outerRadius={100}
            label
          >
            {data.map((entry, index) => (
              <Cell key={entry.category} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => formatMoney(Number(value), currency)} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

