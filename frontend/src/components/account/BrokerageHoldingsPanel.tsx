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

type HoldingsPanelData = {
  holdings: AccountHolding[];
  holdingsValue: number;
  trades: AssetTrade[];
};

export function BrokerageHoldingsPanel(props: Props) {
  const { accountId, currency, onChanged } = props;
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Instrument[]>([]);
  const [instrumentId, setInstrumentId] = useState<number | null>(null);
  const [instrumentLabel, setInstrumentLabel] = useState("");
  const [side, setSide] = useState<AssetTradeSide>("BUY");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [commission, setCommission] = useState("0");
  const [occurredAt, setOccurredAt] = useState(defaultOccurredAtValue);

  const loadPanel = useCallback(async (): Promise<HoldingsPanelData> => {
    const [h, t] = await Promise.all([
      fetchAccountHoldings(accountId),
      fetchAssetTrades(accountId, { limit: 50 }),
    ]);
    return {
      holdings: h.holdings,
      holdingsValue: h.holdingsValue,
      trades: t.items,
    };
  }, [accountId]);

  const { data, error, loading, reload } = useAsyncData(loadPanel);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setHits([]);
      return;
    }
    const handle = window.setTimeout(() => {
      void searchInstruments({ q, limit: 8, scope: "catalog" })
        .then(setHits)
        .catch(() => setHits([]));
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
      reload();
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
      reload();
      onChanged();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  const holdings = data?.holdings ?? [];
  const holdingsValue = data?.holdingsValue ?? 0;
  const trades = data?.trades ?? [];

  return (
    <section className="panel" aria-label="Holdings and trades">
      <h2>Holdings</h2>
      <StatusBlock
        loading={loading && data == null}
        error={error}
        loadingMessage="Loading holdings…"
      />
      {data ? (
        <>
          <p>
            Mark-to-market{" "}
            <strong>{formatMoney(holdingsValue, currency)}</strong>
          </p>
          {formError ? <p className="error-banner">{formError}</p> : null}
          {holdings.length === 0 ? (
            <p className="empty-state" role="status">
              No open holdings.
            </p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Qty</th>
                  <th>Last close</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((h) => (
                  <tr key={h.id}>
                    <td>
                      {h.symbol ?? h.instrumentId}
                      {h.name ? ` · ${h.name}` : ""}
                    </td>
                    <td>{h.quantity}</td>
                    <td>
                      {h.lastClose != null
                        ? formatMoney(h.lastClose, h.currency)
                        : "—"}
                      {h.lastCloseAsOf ? ` (${h.lastCloseAsOf})` : ""}
                    </td>
                    <td>
                      {h.marketValue != null
                        ? formatMoney(h.marketValue, h.currency)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h3>New trade</h3>
          <form className="form-grid" onSubmit={handleSubmit}>
            <label>
              Instrument
              <input
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
                type="date"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                required
              />
            </label>
            <label>
              Side
              <select
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
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                inputMode="decimal"
                required
              />
            </label>
            <label>
              Unit price
              <input
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                inputMode="decimal"
                required
              />
            </label>
            <label>
              Commission
              <input
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
                inputMode="decimal"
              />
            </label>
            <button type="submit" className="btn-primary" disabled={busy}>
              Record trade
            </button>
          </form>

          <h3>Recent trades</h3>
          {trades.length === 0 ? (
            <p className="empty-state" role="status">
              No trades yet.
            </p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Side</th>
                  <th>Symbol</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => (
                  <tr key={t.id}>
                    <td>{formatOccurredAt(t.occurredAt)}</td>
                    <td>{t.side}</td>
                    <td>{t.instrumentSymbol ?? t.instrumentId}</td>
                    <td>{t.quantity}</td>
                    <td>{formatMoney(t.unitPrice, t.currency)}</td>
                    <td>
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
          )}
        </>
      ) : null}
    </section>
  );
}
