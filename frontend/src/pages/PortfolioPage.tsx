import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { fetchAccounts, type Account } from "../api/accountsApi";
import {
  fetchPortfolioPositions,
  type AssetBucket,
  type PortfolioPosition,
} from "../api/portfolioApi";
import { useAsyncData } from "../hooks/useAsyncData";
import { formatMoney } from "../utils/format";

const BUCKET_OPTIONS: Array<{ id: "" | AssetBucket; label: string }> = [
  { id: "", label: "All buckets" },
  { id: "stock_market", label: "Stock market" },
  { id: "crypto", label: "Crypto" },
  { id: "precious_metal_other", label: "Precious metals" },
  { id: "real_estate", label: "Real estate" },
];

const TYPE_OPTIONS = [
  { id: "", label: "All types" },
  { id: "STOCK", label: "Stock" },
  { id: "ETF", label: "ETF" },
  { id: "BOND", label: "Bond" },
  { id: "FUND", label: "Fund" },
  { id: "OTHER", label: "Other" },
];

function instrumentLabel(row: PortfolioPosition): string {
  const { symbol, name } = row.instrument;
  return name ? `${symbol} — ${name}` : symbol;
}

function bucketLabel(bucket: AssetBucket): string {
  return BUCKET_OPTIONS.find((o) => o.id === bucket)?.label ?? bucket;
}

export function PortfolioPage() {
  const [accountId, setAccountId] = useState<number | "">("");
  const [instrumentType, setInstrumentType] = useState("");
  const [assetBucket, setAssetBucket] = useState<"" | AssetBucket>("");

  const accountsLoader = useCallback(() => fetchAccounts(), []);
  const accountsQuery = useAsyncData(accountsLoader);

  const positionsLoader = useCallback(
    () =>
      fetchPortfolioPositions({
        accountId: accountId === "" ? undefined : accountId,
        instrumentType: instrumentType || undefined,
        assetBucket: assetBucket || undefined,
      }),
    [accountId, instrumentType, assetBucket],
  );
  const positionsQuery = useAsyncData(positionsLoader);

  const accounts: Account[] = accountsQuery.data ?? [];
  const positions = positionsQuery.data?.positions ?? [];

  return (
    <div className="page">
      <h1 className="page-title">Portfolio</h1>
      <p className="muted page-lead">
        All open positions across your accounts. Values use each account&apos;s currency.
      </p>

      <div className="transaction-filters card inline-form">
        <label>
          Account
          <select
            value={accountId === "" ? "" : String(accountId)}
            onChange={(e) =>
              setAccountId(e.target.value === "" ? "" : Number(e.target.value))
            }
          >
            <option value="">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Instrument type
          <select
            value={instrumentType}
            onChange={(e) => setInstrumentType(e.target.value)}
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.id || "all"} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Asset bucket
          <select
            value={assetBucket}
            onChange={(e) => setAssetBucket(e.target.value as "" | AssetBucket)}
          >
            {BUCKET_OPTIONS.map((o) => (
              <option key={o.id || "all"} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {positionsQuery.error && (
        <p className="error-banner">{positionsQuery.error}</p>
      )}
      {positionsQuery.loading && <p className="loading-state">Loading positions…</p>}

      {!positionsQuery.loading && !positionsQuery.error && (
        <>
          <p className="muted">
            {positions.length} open position{positions.length === 1 ? "" : "s"}
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Type</th>
                  <th>Exchange</th>
                  <th>Bucket</th>
                  <th>Account</th>
                  <th>Quantity</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {positions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="muted">
                      No open positions match the filters.
                    </td>
                  </tr>
                ) : (
                  positions.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <Link to={`/accounts/${row.accountId}/holdings/${row.id}`}>
                          {instrumentLabel(row)}
                        </Link>
                        {' · '}
                        <Link to={`/assets/${row.instrumentId}`} className="muted">
                          price chart
                        </Link>
                      </td>
                      <td>{row.instrument.instrumentType}</td>
                      <td>{row.instrument.exchange ?? "—"}</td>
                      <td>{bucketLabel(row.assetBucket)}</td>
                      <td>
                        <Link to={`/accounts/${row.accountId}`}>{row.accountName}</Link>
                      </td>
                      <td>{row.quantity}</td>
                      <td>
                        {row.marketValue != null
                          ? formatMoney(row.marketValue, row.accountCurrency)
                          : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
