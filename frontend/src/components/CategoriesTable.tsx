import { useEffect, useState } from 'react'
import {
  createCategory,
  deleteCategory,
  fetchCategories,
  type CategoryKind,
  type CategoryNode,
} from '../api/categoriesApi'

export function CategoriesTable() {
  const [categories, setCategories] = useState<CategoryNode[]>([])
  const [kind, setKind] = useState<CategoryKind>('EXPENSE')
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState<number | ''>('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void load()
  }, [kind])

  async function load() {
    setError(null)
    try {
      setCategories(await fetchCategories(kind))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await createCategory({
      name: name.trim(),
      kind,
      parentId: parentId === '' ? null : parentId,
    })
    setName('')
    setParentId('')
    await load()
  }

  return (
    <div className="card">
      <div className="transaction-filters">
        <label>
          Kind
          <select value={kind} onChange={(e) => setKind(e.target.value as CategoryKind)}>
            <option value="EXPENSE">Expenses</option>
            <option value="INCOME">Income</option>
          </select>
        </label>
      </div>

      <form className="form-grid" onSubmit={handleSubmit}>
        <label>
          Name
          <input required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Parent category
          <select
            value={parentId}
            onChange={(e) =>
              setParentId(e.target.value === '' ? '' : Number(e.target.value))
            }
          >
            <option value="">— none —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.path}
              </option>
            ))}
          </select>
        </label>
        <div className="form-actions">
          <button type="submit" className="btn-primary">
            Add category
          </button>
        </div>
      </form>

      {error && <p className="auth-error">{error}</p>}

      <ul>
        {categories.map((c) => (
          <li key={c.id}>
            {c.path}
            <button
              type="button"
              onClick={() => {
                void deleteCategory(c.id).then(load)
              }}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
