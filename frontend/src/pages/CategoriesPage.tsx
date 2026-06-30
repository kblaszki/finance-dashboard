import { useCallback, useState } from 'react'
import {
  createCategory,
  deleteCategory,
  fetchCategories,
  updateCategory,
  type Category,
} from '../api/categoriesApi'
import { useAsyncData } from '../hooks/useAsyncData'

export function CategoriesPage() {
  const { data, error, loading, reload } = useAsyncData(fetchCategories)
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState<number | ''>('')
  const [formError, setFormError] = useState<string | null>(null)

  const handleCreate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setFormError(null)
      try {
        await createCategory({
          name: name.trim(),
          ...(parentId !== '' ? { parentId: Number(parentId) } : {}),
        })
        setName('')
        setParentId('')
        reload()
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'Failed to create category')
      }
    },
    [name, parentId, reload],
  )

  async function handleDelete(row: Category) {
    if (!confirm(`Delete category "${row.name}"?`)) return
    setFormError(null)
    try {
      await deleteCategory(row.id)
      reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to delete category')
    }
  }

  async function handleRename(row: Category) {
    const next = prompt('New name', row.name)?.trim()
    if (!next || next === row.name) return
    setFormError(null)
    try {
      await updateCategory(row.id, { name: next })
      reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to update category')
    }
  }

  const flat = data?.flat ?? []
  const parentName = (id: number | null) =>
    id == null ? '—' : (flat.find((c) => c.id === id)?.name ?? String(id))

  return (
    <div className="page">
      <h1 className="page-title">Categories</h1>
      <p className="muted page-lead">
        Organize income and expenses. Transactions can reference these categories (FR-015).
      </p>
      {(formError ?? error) && <p className="error-banner">{formError ?? error}</p>}

      <section className="card">
        <h2>New category</h2>
        <form className="inline-form" onSubmit={(e) => void handleCreate(e)}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" required />
          <select value={parentId} onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">No parent (top level)</option>
            {flat.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-primary">Add</button>
        </form>
      </section>

      <section className="card">
        <h2>All categories ({loading && !data ? '…' : flat.length})</h2>
        {flat.length === 0 ? (
          <p className="muted">No categories yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Parent</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {flat.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td className="muted">{parentName(row.parentId)}</td>
                    <td className="table-actions">
                      <button type="button" className="btn-link" onClick={() => void handleRename(row)}>
                        Rename
                      </button>
                      <button type="button" className="btn-link danger" onClick={() => void handleDelete(row)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
