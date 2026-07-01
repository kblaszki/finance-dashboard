import { useCallback, useState } from 'react'
import {
  createCategorizationRule,
  deleteCategorizationRule,
  fetchCategorizationRules,
  type CategorizationRule,
  type CategorizationRuleInput,
} from '../api/categorizationRulesApi'
import { CategoryPicker } from './CategoryPicker'
import { useAsyncData } from '../hooks/useAsyncData'

function emptyForm(): CategorizationRuleInput {
  return {
    categoryId: 0,
    pattern: '',
    matchType: 'contains',
    priority: 0,
    active: true,
  }
}

export function CategorizationRulesSection() {
  const { data: rules, error, loading, reload } = useAsyncData(fetchCategorizationRules)
  const [form, setForm] = useState<CategorizationRuleInput>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!form.categoryId || !form.pattern.trim()) {
        setFormError('Category and pattern are required')
        return
      }
      setFormError(null)
      try {
        await createCategorizationRule(form)
        setForm(emptyForm())
        await reload()
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'Failed to save rule')
      }
    },
    [form, reload],
  )

  async function handleDelete(row: CategorizationRule) {
    if (!window.confirm(`Delete rule "${row.pattern}"?`)) return
    try {
      await deleteCategorizationRule(row.id)
      await reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  return (
    <section className="card">
      <h2>Auto-categorization rules (FR-034)</h2>
      <p className="muted">Match import descriptions to categories. Higher priority wins.</p>
      {formError && <p className="error-banner">{formError}</p>}
      {error && <p className="error-banner">{error}</p>}

      <form className="inline-form form-section-gap" onSubmit={(e) => void handleSubmit(e)}>
        <CategoryPicker
          value={form.categoryId || null}
          onChange={(id) => setForm((f) => ({ ...f, categoryId: id ?? 0 }))}
        />
        <input
          type="text"
          placeholder="Pattern (e.g. BIEDRONKA)"
          value={form.pattern}
          onChange={(e) => setForm((f) => ({ ...f, pattern: e.target.value }))}
          required
        />
        <select
          value={form.matchType}
          onChange={(e) =>
            setForm((f) => ({ ...f, matchType: e.target.value as 'contains' | 'regex' }))
          }
        >
          <option value="contains">contains</option>
          <option value="regex">regex</option>
        </select>
        <input
          type="number"
          placeholder="Priority"
          value={form.priority ?? 0}
          onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))}
        />
        <button type="submit" className="btn-primary" disabled={!form.categoryId}>
          Add rule
        </button>
      </form>

      {loading && <p className="muted">Loading…</p>}
      {rules && rules.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Pattern</th>
              <th>Category</th>
              <th>Type</th>
              <th>Priority</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rules.map((row) => (
              <tr key={row.id}>
                <td>{row.pattern}</td>
                <td>{row.categoryName}</td>
                <td>{row.matchType}</td>
                <td>{row.priority}</td>
                <td>
                  <button type="button" className="btn-link danger" onClick={() => void handleDelete(row)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
