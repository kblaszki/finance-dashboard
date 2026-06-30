import { useMemo } from 'react'
import { useAsyncData } from '../hooks/useAsyncData'
import { fetchCategories, type Category } from '../api/categoriesApi'

type Props = {
  value: number | null
  onChange: (categoryId: number | null, categoryName: string) => void
  allowEmpty?: boolean
}

export function CategoryPicker({ value, onChange, allowEmpty = false }: Props) {
  const { data, loading } = useAsyncData(fetchCategories)
  const options = useMemo(() => data?.flat ?? [], [data])

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const raw = e.target.value
    if (!raw) {
      onChange(null, '')
      return
    }
    const id = Number(raw)
    const cat = options.find((c: Category) => c.id === id)
    onChange(id, cat?.name ?? '')
  }

  return (
    <select value={value ?? ''} onChange={handleChange} disabled={loading && !data}>
      {allowEmpty && <option value="">—</option>}
      {loading && !options.length ? <option value="">Loading…</option> : null}
      {options.map((c: Category) => (
        <option key={c.id} value={c.id}>
          {c.parentId != null ? `↳ ${c.name}` : c.name}
        </option>
      ))}
    </select>
  )
}
