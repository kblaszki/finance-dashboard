import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchTaxCalendar, updateTaxChecklistItem } from '../api/taxCalendarApi'
import { useAsyncData } from '../hooks/useAsyncData'

const CURRENT_YEAR = new Date().getFullYear()

export function TaxCalendarPage() {
  const [year, setYear] = useState(CURRENT_YEAR)
  const loader = useCallback(() => fetchTaxCalendar(year), [year])
  const { data, error, loading, reload } = useAsyncData(loader)

  async function toggleItem(itemKey: string, completed: boolean) {
    await updateTaxChecklistItem(year, itemKey, completed)
    reload()
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Tax calendar</h1>
        <p className="muted">Deadlines and filing checklist (FR-045).</p>
        <p>
          <Link to="/tax">← Tax report</Link>
        </p>
      </header>

      <section className="card inline-form">
        <label>
          Tax year
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            min={2000}
            max={2100}
          />
        </label>
      </section>

      {loading && !data ? <p className="muted">Loading…</p> : null}
      {error ? <p className="error-banner">{error}</p> : null}
      {data?.correctionNeeded ? (
        <p className="error-banner">
          Tax year {year} may require correction — review reports before filing (FR-048).
        </p>
      ) : null}

      {data ? (
        <>
          <section className="card">
            <h2>Deadlines</h2>
            <ul>
              {data.deadlines.map((d) => (
                <li key={d.date}>
                  <strong>{d.date}</strong> — {d.title}: {d.description}
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <h2>Checklist</h2>
            <ul className="checklist">
              {data.checklist.map((item) => (
                <li key={item.key}>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={(e) => void toggleItem(item.key, e.target.checked)}
                    />
                    {item.label}
                  </label>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  )
}
