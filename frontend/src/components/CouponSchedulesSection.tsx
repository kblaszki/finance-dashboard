import { useEffect, useState } from 'react'
import { fetchAccounts, type Account } from '../api/accountsApi'
import { fetchAccountHoldings } from '../api/holdingsApi'
import {
  createCouponSchedule,
  deleteCouponSchedule,
  fetchCouponSchedules,
  recordCouponScheduleIncome,
  type CouponSchedule,
  type CouponScheduleInput,
  type CouponScheduleType,
} from '../api/couponSchedulesApi'
import { useAsyncData } from '../hooks/useAsyncData'
import { SUPPORTED_CURRENCIES } from '../state/currency'
import { formatMoney } from '../utils/format'

const SCHEDULE_TYPES: CouponScheduleType[] = ['coupon', 'amortization']

type HoldingOption = { instrumentId: number; symbol: string; instrumentType: string }

function emptyForm(accountId: number, currency: string): CouponScheduleInput {
  return {
    accountId,
    instrumentId: 0,
    scheduleType: 'coupon',
    amount: 0,
    currency,
    date: new Date().toISOString().slice(0, 10),
    description: '',
  }
}

export function CouponSchedulesSection() {
  const { data: accounts } = useAsyncData(fetchAccounts)
  const brokerageAccounts = (accounts ?? []).filter((a: Account) => a.accountType === 'BROKERAGE')
  const { data: schedules, error, loading, reload } = useAsyncData(fetchCouponSchedules)
  const [form, setForm] = useState<CouponScheduleInput>(() => emptyForm(0, 'PLN'))
  const [holdings, setHoldings] = useState<HoldingOption[]>([])
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (brokerageAccounts.length && !form.accountId) {
      setForm((current) => ({
        ...current,
        accountId: brokerageAccounts[0].id,
        currency: brokerageAccounts[0].currency,
      }))
    }
  }, [brokerageAccounts, form.accountId])

  useEffect(() => {
    if (!form.accountId) {
      setHoldings([])
      return
    }
    let cancelled = false
    void fetchAccountHoldings(form.accountId).then((data) => {
      if (cancelled) return
      const bondEtf = data.open
        .filter((h) => h.instrument.instrumentType === 'BOND' || h.instrument.instrumentType === 'ETF')
        .map((h) => ({
          instrumentId: h.instrumentId,
          symbol: h.instrument.symbol,
          instrumentType: h.instrument.instrumentType,
        }))
      setHoldings(bondEtf)
      if (bondEtf.length && !bondEtf.some((b) => b.instrumentId === form.instrumentId)) {
        setForm((f) => ({ ...f, instrumentId: bondEtf[0].instrumentId }))
      }
    })
    return () => {
      cancelled = true
    }
  }, [form.accountId, form.instrumentId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.accountId || !form.instrumentId || form.amount <= 0) {
      setFormError('Account, instrument, and positive amount are required')
      return
    }
    setFormError(null)
    try {
      await createCouponSchedule(form)
      setForm((f) => ({ ...emptyForm(f.accountId, f.currency), instrumentId: f.instrumentId }))
      await reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save schedule')
    }
  }

  async function handleRecord(row: CouponSchedule) {
    try {
      await recordCouponScheduleIncome(row.id)
      await reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to record income')
    }
  }

  async function handleDelete(row: CouponSchedule) {
    if (!window.confirm('Delete this scheduled payment?')) return
    try {
      await deleteCouponSchedule(row.id)
      await reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  return (
    <section className="card">
      <h2>Bond &amp; ETF coupon schedule</h2>
      <p className="muted">
        Plan coupon or amortization payments (FR-033), then record them as income events when paid.
      </p>
      {formError && <p className="error-banner">{formError}</p>}
      {error && <p className="error-banner">{error}</p>}

      {brokerageAccounts.length === 0 ? (
        <p className="muted">Add a brokerage account with bond or ETF holdings first.</p>
      ) : (
        <form className="inline-form form-section-gap" onSubmit={(e) => void handleSubmit(e)}>
          <select
            value={form.accountId || ''}
            onChange={(e) => {
              const account = brokerageAccounts.find((a) => a.id === Number(e.target.value))
              setForm((f) => ({
                ...f,
                accountId: Number(e.target.value),
                currency: account?.currency ?? f.currency,
              }))
            }}
          >
            {brokerageAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <select
            value={form.instrumentId || ''}
            onChange={(e) => setForm((f) => ({ ...f, instrumentId: Number(e.target.value) }))}
            disabled={!holdings.length}
          >
            {holdings.length === 0 && <option value="">No bond/ETF holdings</option>}
            {holdings.map((h) => (
              <option key={h.instrumentId} value={h.instrumentId}>
                {h.symbol} ({h.instrumentType})
              </option>
            ))}
          </select>
          <select
            value={form.scheduleType}
            onChange={(e) =>
              setForm((f) => ({ ...f, scheduleType: e.target.value as CouponScheduleType }))
            }
          >
            {SCHEDULE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            required
          />
          <input
            type="number"
            step="0.01"
            min="0.0001"
            placeholder="Amount"
            value={form.amount || ''}
            onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))}
            required
          />
          <select
            value={form.currency}
            onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-primary" disabled={!holdings.length}>
            Add schedule
          </button>
        </form>
      )}

      {loading && <p className="muted">Loading…</p>}
      {schedules && schedules.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Payment date</th>
              <th>Account</th>
              <th>Instrument</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {schedules.map((row) => (
              <tr key={row.id}>
                <td>{row.paymentOn.slice(0, 10)}</td>
                <td>{row.accountName}</td>
                <td>{row.instrumentSymbol}</td>
                <td>{row.scheduleType}</td>
                <td>{formatMoney(row.amount, row.currency)}</td>
                <td>{row.recorded ? 'Recorded' : 'Pending'}</td>
                <td>
                  {!row.recorded && (
                    <>
                      <button type="button" className="btn-link" onClick={() => void handleRecord(row)}>
                        Record income
                      </button>
                      {' · '}
                      <button type="button" className="btn-link danger" onClick={() => void handleDelete(row)}>
                        Delete
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
