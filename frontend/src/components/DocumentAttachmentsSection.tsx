import { useCallback, useState } from 'react'
import {
  createDocumentAttachment,
  deleteDocumentAttachment,
  fetchDocumentAttachments,
  type DocumentAttachment,
} from '../api/documentAttachmentsApi'
import { useAsyncData } from '../hooks/useAsyncData'

const ENTITY_TYPES = [
  { value: 'transaction', label: 'Transaction' },
  { value: 'income_event', label: 'Income event' },
  { value: 'property_cash_flow', label: 'Property cash flow' },
] as const

export function DocumentAttachmentsSection() {
  const { data: rows, error, loading, reload } = useAsyncData(() => fetchDocumentAttachments())
  const [form, setForm] = useState({
    entityType: 'transaction' as (typeof ENTITY_TYPES)[number]['value'],
    entityId: 0,
    filename: '',
    description: '',
  })
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!form.entityId || !form.filename.trim()) {
        setFormError('Entity ID and filename are required')
        return
      }
      setFormError(null)
      try {
        await createDocumentAttachment({
          entityType: form.entityType,
          entityId: form.entityId,
          filename: form.filename.trim(),
          description: form.description.trim() || null,
        })
        setForm((f) => ({ ...f, entityId: 0, filename: '', description: '' }))
        await reload()
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'Failed to save')
      }
    },
    [form, reload],
  )

  async function handleDelete(row: DocumentAttachment) {
    if (!window.confirm(`Delete attachment "${row.filename}"?`)) return
    try {
      await deleteDocumentAttachment(row.id)
      await reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  return (
    <section className="card form-section-gap">
      <h2 className="section-title">Document references</h2>
      <p className="muted">
        Metadata-only attachments (filename, storage ref). File upload is out of MVP scope.
      </p>
      {formError && <p className="error-banner">{formError}</p>}
      {error && <p className="error-banner">{error}</p>}

      <form className="inline-form form-section-gap" onSubmit={(e) => void handleSubmit(e)}>
        <select
          value={form.entityType}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              entityType: e.target.value as (typeof ENTITY_TYPES)[number]['value'],
            }))
          }
        >
          {ENTITY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          placeholder="Entity ID"
          value={form.entityId || ''}
          onChange={(e) => setForm((f) => ({ ...f, entityId: Number(e.target.value) }))}
          required
        />
        <input
          type="text"
          placeholder="Filename"
          value={form.filename}
          onChange={(e) => setForm((f) => ({ ...f, filename: e.target.value }))}
          required
        />
        <input
          type="text"
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
        <button type="submit" className="btn-primary">
          Add reference
        </button>
      </form>

      {loading && <p className="muted">Loading…</p>}
      {rows && rows.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Entity</th>
              <th>File</th>
              <th>Uploaded</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.entityType}</td>
                <td>{row.entityId}</td>
                <td>{row.filename}</td>
                <td>{new Date(row.uploadedAt).toLocaleDateString('en-US')}</td>
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
