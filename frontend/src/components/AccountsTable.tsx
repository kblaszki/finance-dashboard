import { useEffect, useState } from 'react'
import {
  createAccount,
  deleteAccount,
  fetchAccounts,
  updateAccount,
  type LegacyAccountType as AccountType,
  type FinancialAccount,
  type FinancialAccountInput,
} from '../api/accountsApi'
import { createBondHolding, deleteBondHolding, fetchBondHoldings, type BondHolding } from '../api/bondsApi'
import { SUPPORTED_CURRENCIES } from '../state/currency'
import { formatMoney } from '../utils/format'

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'BANK', label: 'Konto bankowe' },
  { value: 'REAL_ESTATE', label: 'Nieruchomość' },
  { value: 'CRYPTO', label: 'Kryptowaluty' },
  { value: 'LIABILITY', label: 'Zobowiązanie' },
  { value: 'BONDS', label: 'Obligacje' },
]

const TYPE_ORDER: Record<AccountType, number> = {
  BANK: 0,
  BONDS: 1,
  REAL_ESTATE: 2,
  CRYPTO: 3,
  LIABILITY: 4,
}

function typeLabel(type: AccountType): string {
  return ACCOUNT_TYPES.find((t) => t.value === type)?.label ?? type
}

const emptyForm: FinancialAccountInput = {
  type: 'BANK',
  name: '',
  currency: 'PLN',
  openingBalance: 0,
  manualValue: null,
}

export function AccountsTable() {
  const [accounts, setAccounts] = useState<FinancialAccount[]>([])
  const [form, setForm] = useState(emptyForm)
  const [bondAccountId, setBondAccountId] = useState<number | null>(null)
  const [bonds, setBonds] = useState<BondHolding[]>([])
  const [bondForm, setBondForm] = useState({
    series: 'EDO',
    nominal: 0,
    purchaseDate: new Date().toISOString().slice(0, 10),
    currency: 'PLN',
  })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    if (bondAccountId) void loadBonds(bondAccountId)
    else setBonds([])
  }, [bondAccountId])

  async function load() {
    setError(null)
    try {
      const rows = await fetchAccounts()
      rows.sort((a, b) => {
        const oa = TYPE_ORDER[a.type] ?? 99
        const ob = TYPE_ORDER[b.type] ?? 99
        if (oa !== ob) return oa - ob
        return a.name.localeCompare(b.name, 'pl')
      })
      setAccounts(rows)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd ładowania')
    }
  }

  async function loadBonds(accountId: number) {
    const rows = await fetchBondHoldings(accountId)
    setBonds(rows)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setError(null)
    try {
      await createAccount({
        ...form,
        name: form.name.trim(),
        openingBalance: form.type === 'BANK' ? Number(form.openingBalance ?? 0) : 0,
        manualValue:
          form.type !== 'BANK' && form.type !== 'BONDS'
            ? Number(form.manualValue ?? 0)
            : null,
      })
      setForm(emptyForm)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się dodać konta')
    }
  }

  async function handleBondSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!bondAccountId || bondForm.nominal <= 0) return
    await createBondHolding(bondAccountId, bondForm)
    setBondForm({ ...bondForm, nominal: 0 })
    await loadBonds(bondAccountId)
    await load()
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Usunąć konto?')) return
    await deleteAccount(id)
    await load()
  }

  async function handleManualValueUpdate(id: number, manualValue: number) {
    await updateAccount(id, { manualValue })
    await load()
  }

  return (
    <div className="card">
      <form className="form-grid" onSubmit={handleSubmit}>
        <label>
          Typ
          <select
            value={form.type}
            onChange={(e) =>
              setForm({ ...form, type: e.target.value as AccountType })
            }
          >
            {ACCOUNT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Nazwa
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label>
          Waluta
          <select
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        {form.type === 'BANK' ? (
          <label>
            Saldo początkowe
            <input
              type="number"
              step="0.01"
              value={form.openingBalance ?? 0}
              onChange={(e) =>
                setForm({ ...form, openingBalance: Number(e.target.value) })
              }
            />
          </label>
        ) : form.type !== 'BONDS' ? (
          <label>
            Wartość / saldo
            <input
              type="number"
              step="0.01"
              value={form.manualValue ?? 0}
              onChange={(e) =>
                setForm({ ...form, manualValue: Number(e.target.value) })
              }
            />
          </label>
        ) : null}
        <div className="form-actions">
          <button type="submit" className="btn-primary">
            Dodaj konto
          </button>
        </div>
      </form>

      {error && <p className="auth-error">{error}</p>}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nazwa</th>
              <th>Typ</th>
              <th>Wartość / saldo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td>{typeLabel(a.type)}</td>
                <td>
                  {a.type === 'BANK' ? (
                    <strong>{formatMoney(a.balance ?? 0, a.currency)}</strong>
                  ) : a.type === 'BONDS' ? (
                    formatMoney(a.manualValue ?? 0, a.currency)
                  ) : (
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={a.manualValue ?? 0}
                      onBlur={(e) =>
                        void handleManualValueUpdate(a.id, Number(e.target.value))
                      }
                    />
                  )}
                </td>
                <td>
                  {a.type === 'BONDS' && (
                    <button type="button" onClick={() => setBondAccountId(a.id)}>
                      Obligacje
                    </button>
                  )}
                  <button type="button" onClick={() => void handleDelete(a.id)}>
                    Usuń
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {bondAccountId && (
        <section style={{ marginTop: '1.5rem' }}>
          <h3>Pozycje obligacji</h3>
          <form className="form-grid" onSubmit={handleBondSubmit}>
            <label>
              Seria
              <input
                value={bondForm.series}
                onChange={(e) => setBondForm({ ...bondForm, series: e.target.value })}
              />
            </label>
            <label>
              Nominał
              <input
                type="number"
                min={0.01}
                value={bondForm.nominal || ''}
                onChange={(e) =>
                  setBondForm({ ...bondForm, nominal: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Data zakupu
              <input
                type="date"
                value={bondForm.purchaseDate}
                onChange={(e) =>
                  setBondForm({ ...bondForm, purchaseDate: e.target.value })
                }
              />
            </label>
            <div className="form-actions">
              <button type="submit" className="btn-primary">
                Dodaj obligację
              </button>
            </div>
          </form>
          <ul>
            {bonds.map((b) => (
              <li key={b.id}>
                {b.series}: {formatMoney(b.nominal, b.currency)} (
                {new Date(b.purchaseDate).toLocaleDateString()})
                <button
                  type="button"
                  onClick={() => {
                    void deleteBondHolding(b.id).then(() => loadBonds(bondAccountId))
                    void load()
                  }}
                >
                  Usuń
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
