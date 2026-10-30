import { useCallback, useEffect, useMemo, useState } from "react";
import {
  searchInstruments,
  type Instrument,
} from "../api/instrumentsApi";
import {
  addToWatchlist,
  fetchWatchlist,
  removeFromWatchlist,
  type WatchlistItem,
} from "../api/watchlistApi";
import { StatusBlock } from "../components/ui/StatusBlock";
import { useAsyncData } from "../hooks/useAsyncData";
import { formatMoney } from "../utils/format";

const SEARCH_DEBOUNCE_MS = 300;

export function MarketsPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<Instrument[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusyId, setActionBusyId] = useState<number | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [query]);

  const loadWatchlist = useCallback(() => fetchWatchlist(), []);
  const {
    data: watchlist,
    error: watchlistError,
    loading: watchlistLoading,
    reload: reloadWatchlist,
  } = useAsyncData(loadWatchlist);

  useEffect(() => {
    if (debouncedQuery.length < 1) {
      setResults([]);
      setSearchError(null);
      setSearchBusy(false);
      return;
    }
    let cancelled = false;
    setSearchBusy(true);
    setSearchError(null);
    void searchInstruments({ q: debouncedQuery, limit: 25 })
      .then((rows) => {
        if (!cancelled) setResults(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setResults([]);
          setSearchError(
            err instanceof Error ? err.message : "Search failed",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setSearchBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const favoritedIds = useMemo(() => {
    const set = new Set<number>();
    for (const item of watchlist ?? []) set.add(item.instrumentId);
    return set;
  }, [watchlist]);

  async function handleAdd(instrument: Instrument) {
    setActionError(null);
    setActionBusyId(instrument.id);
    try {
      await addToWatchlist(instrument.id);
      reloadWatchlist();
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Could not add to watchlist",
      );
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleRemove(item: WatchlistItem) {
    setActionError(null);
    setActionBusyId(item.instrumentId);
    try {
      await removeFromWatchlist(item.instrumentId);
      reloadWatchlist();
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Could not remove from watchlist",
      );
    } finally {
      setActionBusyId(null);
    }
  }

  return (
    <div className="page-stack markets-page">
      <section className="card form-section-gap">
        <h2 className="section-title">Search stocks &amp; ETFs</h2>
        <p className="muted">
          Search the local catalog (synced from Twelve Data). Add favorites to
          track last close prices. Run{" "}
          <code>npm run market:sync-catalog</code> in <code>backend/</code>{" "}
          after build if the catalog is empty.
        </p>
        <label>
          Search
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Symbol or name (e.g. AAPL, Vanguard)"
            autoComplete="off"
          />
        </label>
        {searchBusy && (
          <p className="muted" role="status">
            Searching…
          </p>
        )}
        {searchError && (
          <p className="error-banner" role="alert">
            {searchError}
          </p>
        )}
        {!searchBusy && debouncedQuery && results.length === 0 && !searchError && (
          <p className="empty-state muted" role="status">
            No instruments match “{debouncedQuery}”.
          </p>
        )}
        {results.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Name</th>
                  <th>Exchange</th>
                  <th>Class</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {results.map((row) => {
                  const onList = favoritedIds.has(row.id);
                  return (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.symbol}</strong>
                      </td>
                      <td>{row.name}</td>
                      <td>{row.exchange || "—"}</td>
                      <td>{row.assetClass}</td>
                      <td>
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={onList || actionBusyId === row.id}
                          onClick={() => void handleAdd(row)}
                        >
                          {onList ? "On watchlist" : "Add"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {actionError && (
        <p className="error-banner" role="alert">
          {actionError}
        </p>
      )}

      <section className="card form-section-gap">
        <h2 className="section-title">Watchlist</h2>
        <p className="muted">
          Last close from stored Twelve Data valuations. Refresh prices with{" "}
          <code>npm run market:sync-quotes</code> (after <code>npm run build</code>{" "}
          in backend).
        </p>
        <StatusBlock
          loading={watchlistLoading && !watchlist}
          error={watchlistError}
          empty={!!watchlist && watchlist.length === 0}
          loadingMessage="Loading watchlist…"
          emptyMessage="No favorites yet. Search above and add an instrument."
        />
        {watchlist && watchlist.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Name</th>
                  <th>Last close</th>
                  <th>As of</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {watchlist.map((item) => (
                  <tr key={item.instrumentId}>
                    <td>
                      <strong>{item.instrument.symbol}</strong>
                    </td>
                    <td>{item.instrument.name}</td>
                    <td>
                      {item.lastClose != null
                        ? formatMoney(
                            item.lastClose,
                            item.instrument.currency || "USD",
                          )
                        : "—"}
                      {item.lastClose == null && (
                        <span className="muted">
                          {" "}
                          No close yet — run market:sync-quotes or re-add
                        </span>
                      )}
                    </td>
                    <td>{item.asOf ?? "—"}</td>
                    <td>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={actionBusyId === item.instrumentId}
                        onClick={() => void handleRemove(item)}
                      >
                        Remove
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
  );
}
