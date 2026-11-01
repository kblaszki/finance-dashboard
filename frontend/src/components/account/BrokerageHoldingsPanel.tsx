import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  createAssetTrade,
  deleteAssetTrade,
  fetchAssetTrades,
  type AssetTrade,
  type AssetTradeSide,
  type CreateAssetTradeInput,
} from "../../api/assetTradesApi";
import {
  fetchAccountHoldings,
  type AccountHolding,
} from "../../api/holdingsApi";
import { searchInstruments, type Instrument } from "../../api/instrumentsApi";
import { useAsyncData } from "../../hooks/useAsyncData";
import { formatMoney } from "../../utils/format";
import { StatusBlock } from "../ui/StatusBlock";
import {
  dateInputToIso,
  defaultOccurredAtValue,
  formatOccurredAt,
} from "./occurredAt";

type Props = {
  accountId: number;
  currency: string;
  onChanged: () => void;
};

export function BrokerageHoldingsPanel(props: Props) {
  const { accountId, currency, onChanged } = props;
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Instrument[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [instrumentId, setInstrumentId] = useState<number | null>(null);
  const [instrumentLabel, setInstrumentLabel] = useState("");
  const [side, setSide] = useState<AssetTradeSide>("BUY");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [commission, setCommission] = useState("0");
  const [occurredAt, setOccurredAt] = useState(defaultOccurredAtValue);

  const loadHoldings = useCallback(() => fetchAccountHoldings(accountId), [
    accountId,
  ]);
  const {
    data: holdingsData,
    error: holdingsError,
    loading: holdingsLoading,
    reload: reloadHoldings,
  } = useAsyncData(loadHoldings);

  const loadTrades = useCallback(
    () => fetchAssetTrades(accountId, { limit: 50 }),
    [accountId],
  );
  const {
    data: tradesPage,
    error: tradesError,
    loading: tradesLoading,
    reload: reloadTrades,
  } = useAsyncData(loadTrades);

  function reloadPanel() {
    reloadHoldings();
    reloadTrades();
  }

  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setHits([]);
      setSearchError(null);
      return;
    }
    const handle = window.setTimeout(() => {
      void searchInstruments({ q, limit: 8, scope: "catalog" })
        .then((rows) => {
          setHits(rows);
          setSearchError(null);
        })
        .catch((err: unknown) => {
          setHits([]);
          setSearchError(
            err instanceof Error ? err.message : "Instrument search failed",
          );
        });
    }, 250);
    return () => window.clearTimeout(handle);
  }, [query]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (instrumentId == null) {
      setFormError("Pick an instrument");
      return;
    }
    const qty = Number(quantity);
    const price = Number(unitPrice);
    const fee = Number(commission);
    if (!Number.isFinite(qty) || qty <= 0) {
      setFormError("quantity must be positive");
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setFormError("unitPrice must be positive");
      return;
    }
    if (!Number.isFinite(fee) || fee < 0) {
      setFormError("commission must be ≥ 0");
      return;
    }

    let occurredAtIso: string;
    try {
      occurredAtIso = dateInputToIso(occurredAt);
    } catch {
      setFormError("Invalid date");
      return;
    }

    const input: CreateAssetTradeInput = {
      instrumentId,
      side,
      quantity: qty,
      unitPrice: price,
      commission: fee,
      occurredAt: occurredAtIso,
    };
    setBusy(true);
    setFormError(null);
    try {
      await createAssetTrade(accountId, input);
      setQuantity("1");
      setUnitPrice("");
      setCommission("0");
      setOccurredAt(defaultOccurredAtValue());
      reloadPanel();
      onChanged();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Trade failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(trade: AssetTrade) {
    if (
      !window.confirm(
        `Delete ${trade.side} ${trade.quantity} ${trade.instrumentSymbol ?? ""}?`,
      )
    ) {
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await deleteAssetTrade(accountId, trade.id);
      reloadPanel();
      onChanged();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  const holdings: AccountHolding[] = holdingsData?.holdings ?? [];
  const holdingsValue = holdingsData?.holdingsValue ?? 0;
  const trades = tradesPage?.items ?? [];

  return (
    <section className="card" aria-label="Holdings and trades">
      <h2 className="section-title">Holdings</h2>
      <StatusBlock
        loading={holdingsLoading && !holdingsData}
        error={holdingsError}
        loadingMessage="Loading holdings…"
      />
      {holdingsData ? (
        <>
          <p>
            Mark-to-market{" "}
            <strong>{formatMoney(holdingsValue, currency)}</strong>
          </p>
          {holdings.length === 0 ? (
            <p className="empty-state" role="status">
              No open holdings.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th className="num">Qty</th>
                    <th className="num">Last close</th>
                    <th className="num">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((h) => (
                    <tr key={h.id}>
                      <td className="col-text">
                        {h.symbol ?? h.instrumentId}
                        {h.name ? ` · ${h.name}` : ""}
                      </td>
                      <td className="num">{h.quantity}</td>
                      <td className="num">
                        {h.lastClose != null
                          ? formatMoney(h.lastClose, h.currency)
                          : "—"}
                        {h.lastCloseAsOf ? ` (${h.lastCloseAsOf})` : ""}
                      </td>
                      <td className="num">
                        {h.marketValue != null
                          ? formatMoney(h.marketValue, h.currency)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}

      {formError ? <p className="error-banner">{formError}</p> : null}
      {searchError ? <p className="error-banner">{searchError}</p> : null}

      <h3 className="section-title">New trade</h3>
      <form className="form-grid" onSubmit={handleSubmit}>
        <label>
          Instrument
          <input
            className="field-control"
            value={query || instrumentLabel}
            onChange={(e) => {
              setQuery(e.target.value);
              setInstrumentId(null);
              setInstrumentLabel("");
            }}
            placeholder="Search symbol…"
            autoComplete="off"
          />
        </label>
        {hits.length > 0 && instrumentId == null && (
          <ul className="suggest-list">
            {hits.map((hit) => (
              <li key={hit.id}>
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => {
                    setInstrumentId(hit.id);
                    setInstrumentLabel(
                      `${hit.symbol} · ${hit.name} (${hit.currency})`,
                    );
                    setQuery("");
                    setHits([]);
                    setSearchError(null);
                  }}
                >
                  {hit.symbol} · {hit.name} ({hit.currency})
                </button>
              </li>
            ))}
          </ul>
        )}
        <label>
          Date
          <input
            className="field-control"
            type="date"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
            required
          />
        </label>
        <label>
          Side
          <select
            className="field-control"
            value={side}
            onChange={(e) => setSide(e.target.value as AssetTradeSide)}
          >
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
          </select>
        </label>
        <label>
          Quantity
          <input
            className="field-control"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            inputMode="decimal"
            required
          />
        </label>
        <label>
          Unit price
          <input
            className="field-control"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            inputMode="decimal"
            required
          />
        </label>
        <label>
          Commission
          <input
            className="field-control"
            value={commission}
            onChange={(e) => setCommission(e.target.value)}
            inputMode="decimal"
          />
        </label>
        <button type="submit" className="btn-primary" disabled={busy}>
          Record trade
        </button>
      </form>

      <h3 className="section-title">Recent trades</h3>
      <StatusBlock
        loading={tradesLoading && !tradesPage}
        error={tradesError}
        loadingMessage="Loading trades…"
      />
      {tradesPage ? (
        trades.length === 0 ? (
          <p className="empty-state" role="status">
            No trades yet.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Side</th>
                  <th>Symbol</th>
                  <th className="num">Qty</th>
                  <th className="num">Price</th>
                  <th className="col-actions" />
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => (
                  <tr key={t.id}>
                    <td>{formatOccurredAt(t.occurredAt)}</td>
                    <td>{t.side}</td>
                    <td className="col-text">
                      {t.instrumentSymbol ?? t.instrumentId}
                    </td>
                    <td className="num">{t.quantity}</td>
                    <td className="num">
                      {formatMoney(t.unitPrice, t.currency)}
                    </td>
                    <td className="col-actions">
                      <button
                        type="button"
                        className="btn-link"
                        disabled={busy}
                        onClick={() => void handleDelete(t)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}
    </section>
  );
}
