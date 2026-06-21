import { useCallback, useState } from 'react'
import { fetchMarketDataStatus, triggerMarketSync } from '../api/marketDataApi'
import { useAsyncData } from '../hooks/useAsyncData'

type Props = {
  onSynced?: () => void
}

export function MarketPricesStatus({ onSynced }: Props) {
  const loader = useCallback(() => fetchMarketDataStatus(), [])
  const { data, error, loading, reload } = useAsyncData(loader, [])
  const [syncError, setSyncError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  async function handleSync() {
    setSyncError(null)
    setSyncing(true)
    try {
      const result = await triggerMarketSync(90)
      if (result.errors.length) {
        setSyncError(`${result.errors.length} instrument(s) skipped — check server logs or use manual prices.`)
      }
      reload()
      onSynced?.()
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const lastLabel = data?.lastSyncAt
    ? new Date(data.lastSyncAt).toLocaleString('en-US')
    : 'never'

  return (
    <div className="market-data-banner">
      <p className="muted">
        Prices updated: {loading && !data ? '…' : lastLabel}
        {data && data.instrumentCount > 0 && (
          <> · {data.instrumentCount} instrument(s){data.staleCount > 0 ? ` · ${data.staleCount} stale` : ''}</>
        )}
      </p>
      <div className="market-data-banner-actions">
        <button type="button" className="btn-link" disabled={syncing} onClick={() => void handleSync()}>
          {syncing ? 'Syncing…' : 'Sync prices now'}
        </button>
      </div>
      {(error || syncError) && <p className="error-banner">{syncError ?? error}</p>}
    </div>
  )
}
