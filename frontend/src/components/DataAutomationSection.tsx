import { useCallback, useState } from 'react'
import { fetchAccounts, type Account } from '../api/accountsApi'
import {
  fetchAccountSyncSettings,
  runAccountSync,
  upsertAccountSyncSetting,
} from '../api/accountSyncApi'
import {
  authorizeBankConnection,
  createBankConnection,
  deleteBankConnection,
  fetchBankConnections,
} from '../api/bankConnectionsApi'
import { fetchAuditLogs, fetchFullExport } from '../api/exportApi'
import { useAsyncData } from '../hooks/useAsyncData'

export function DataAutomationSection() {
  const { data: accounts } = useAsyncData(fetchAccounts)
  const { data: syncSettings, reload: reloadSync } = useAsyncData(fetchAccountSyncSettings)
  const { data: bankConnections, reload: reloadBanks } = useAsyncData(fetchBankConnections)
  const { data: auditLogs } = useAsyncData(() => fetchAuditLogs({ limit: 20 }))
  const [exportBusy, setExportBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [bankAccountId, setBankAccountId] = useState<number>(0)
  const [bankCode, setBankCode] = useState('MBANK')

  const bankAccounts = (accounts ?? []).filter((a: Account) => a.accountType === 'BANK')

  const handleExport = useCallback(async () => {
    setExportBusy(true)
    setError(null)
    try {
      const data = await fetchFullExport()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'finance-export.json'
      a.click()
      URL.revokeObjectURL(url)
      setMessage('Export downloaded.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setExportBusy(false)
    }
  }, [])

  async function toggleSync(accountId: number, enabled: boolean) {
    setError(null)
    try {
      await upsertAccountSyncSetting(accountId, { syncEnabled: enabled, provider: 'stub' })
      await reloadSync()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update sync')
    }
  }

  async function handleRunSync(accountId: number) {
    setError(null)
    try {
      await runAccountSync(accountId)
      setMessage('Sync completed.')
      await reloadSync()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed')
    }
  }

  async function handleConnectBank(e: React.FormEvent) {
    e.preventDefault()
    if (!bankAccountId) return
    setError(null)
    try {
      await createBankConnection({ accountId: bankAccountId, bankCode })
      await reloadBanks()
      setMessage('Bank connection created (pending PSD2 consent).')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect bank')
    }
  }

  return (
    <>
      <section className="card form-section-gap">
        <h2 className="section-title">Data export (NFR-002)</h2>
        <p className="muted">Download all your accounts, transactions, and tax metadata as JSON.</p>
        <button type="button" className="btn-primary" disabled={exportBusy} onClick={() => void handleExport()}>
          {exportBusy ? 'Exporting…' : 'Export full backup'}
        </button>
      </section>

      <section className="card form-section-gap">
        <h2 className="section-title">Account sync (FR-035)</h2>
        <p className="muted">Enable scheduled sync stub; brokerage/crypto runs market price sync.</p>
        {(accounts ?? []).map((account) => {
          const setting = syncSettings?.find((s) => s.accountId === account.id)
          return (
            <div key={account.id} className="inline-form form-section-gap">
              <span>
                {account.name} ({account.accountType})
              </span>
              <button
                type="button"
                className="btn-link"
                onClick={() => void toggleSync(account.id, !setting?.syncEnabled)}
              >
                {setting?.syncEnabled ? 'Disable sync' : 'Enable sync'}
              </button>
              {setting?.syncEnabled && (
                <button type="button" className="btn-link" onClick={() => void handleRunSync(account.id)}>
                  Run now
                </button>
              )}
            </div>
          )
        })}
      </section>

      <section className="card form-section-gap">
        <h2 className="section-title">PSD2 bank connect (FR-036)</h2>
        <p className="muted">Stub OAuth flow — authorize simulates 90-day consent.</p>
        <form className="inline-form form-section-gap" onSubmit={(e) => void handleConnectBank(e)}>
          <select
            value={bankAccountId || ''}
            onChange={(e) => setBankAccountId(Number(e.target.value))}
          >
            <option value="">Select bank account</option>
            {bankAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <input value={bankCode} onChange={(e) => setBankCode(e.target.value)} placeholder="Bank code" />
          <button type="submit" className="btn-primary" disabled={!bankAccountId}>
            Connect
          </button>
        </form>
        {bankConnections && bankConnections.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Bank</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {bankConnections.map((row) => (
                <tr key={row.id}>
                  <td>{row.accountName}</td>
                  <td>{row.bankCode}</td>
                  <td>{row.status}</td>
                  <td>
                    {row.status === 'pending' && (
                      <button
                        type="button"
                        className="btn-link"
                        onClick={() => void authorizeBankConnection(row.id).then(() => reloadBanks())}
                      >
                        Authorize (stub)
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-link danger"
                      onClick={() => void deleteBankConnection(row.id).then(() => reloadBanks())}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card form-section-gap">
        <h2 className="section-title">Audit trail (NFR-003)</h2>
        <p className="muted">Recent changes to transactions, trades, and transfers.</p>
        {auditLogs && auditLogs.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Entity</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.createdAt).toLocaleString()}</td>
                  <td>
                    {row.entityType} #{row.entityId}
                  </td>
                  <td>{row.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">No audit entries yet.</p>
        )}
      </section>

      {message && <p className="muted">{message}</p>}
      {error && <p className="error-banner">{error}</p>}
    </>
  )
}
