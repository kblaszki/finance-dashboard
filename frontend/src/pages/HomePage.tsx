import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchAccounts } from "../api/accountsApi";
import {
  fetchCashflowRolling12m,
  fetchNetWorth,
  type CashflowRolling12m,
  type NetWorth,
  type NetWorthByBucket,
} from "../api/statisticsApi";
import { useAsyncData } from "../hooks/useAsyncData";
import { useAuth } from "../state/auth";
import { formatMoney } from "../utils/format";

const BUCKET_LABELS: { key: keyof NetWorthByBucket; label: string }[] = [
  { key: "cash", label: "Cash" },
  { key: "stock", label: "Stock" },
  { key: "crypto", label: "Crypto" },
  { key: "metal", label: "Metal" },
  { key: "real_estate", label: "Real estate" },
  { key: "other", label: "Other" },
];

export function HomePage() {
  const { user } = useAuth();
  const [currency, setCurrency] = useState("");

  const loadAccounts = useCallback(() => fetchAccounts(), []);
  const {
    data: accounts,
    error: accountsError,
    loading: accountsLoading,
  } = useAsyncData(loadAccounts);

  const currencies = useMemo(() => {
    if (!accounts) return [];
    return [...new Set(accounts.map((a) => a.currency))].sort((a, b) =>
      a.localeCompare(b),
    );
  }, [accounts]);

  useEffect(() => {
    if (currencies.length === 0) {
      setCurrency("");
      return;
    }
    setCurrency((current) =>
      current && currencies.includes(current) ? current : currencies[0]!,
    );
  }, [currencies]);

  const loadNetWorth = useCallback((): Promise<NetWorth | null> => {
    if (!currency) return Promise.resolve(null);
    return fetchNetWorth(currency);
  }, [currency]);
  const {
    data: netWorth,
    error: netWorthError,
    loading: netWorthLoading,
  } = useAsyncData(loadNetWorth);

  const loadRolling = useCallback((): Promise<CashflowRolling12m | null> => {
    if (!currency) return Promise.resolve(null);
    return fetchCashflowRolling12m(currency);
  }, [currency]);
  const {
    data: rolling,
    error: rollingError,
    loading: rollingLoading,
  } = useAsyncData(loadRolling);

  const kpiLoading =
    accountsLoading || (!!currency && (netWorthLoading || rollingLoading));
  const kpiError = accountsError || netWorthError || rollingError;

  return (
    <div className="page-stack home-folio">
      <p className="home-folio-eyebrow">Home</p>
      <h1 className="page-title">Dashboard</h1>
      <p className="muted home-folio-lead">
        Signed in as <strong>{user?.username ?? user?.email}</strong>. Cash-based
        net worth and rolling cashflow averages for one currency (no FX).
      </p>

      <section className="card form-section-gap period-filter">
        <div className="period-filter-row">
          <label>
            Currency
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              disabled={currencies.length === 0}
            >
              {currencies.length === 0 ? (
                <option value="">No accounts</option>
              ) : (
                currencies.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))
              )}
            </select>
          </label>
        </div>
      </section>

      {kpiLoading && <p className="muted">Loading dashboard…</p>}
      {kpiError && <p className="error-banner">{kpiError}</p>}

      {!kpiLoading && !kpiError && currencies.length === 0 && (
        <p className="empty-state">
          Add an account to see net worth and rolling cashflow KPIs.
        </p>
      )}

      {!kpiLoading && !kpiError && netWorth && currency && (
        <NetWorthSection data={netWorth} />
      )}

      {!kpiLoading && !kpiError && rolling && currency && (
        <RollingCashflowKpis data={rolling} />
      )}

      <div className="home-folio-rule" aria-hidden />
      <div className="home-action-grid">
        <Link to="/accounts" className="card home-action-card">
          <h2 className="section-title">Accounts</h2>
          <p className="muted">
            Accounts — create, edit, and track opening balances by type.
          </p>
        </Link>
        <Link to="/settings" className="card home-action-card">
          <h2 className="section-title">Settings</h2>
          <p className="muted">
            Profile, email, password, and appearance preferences.
          </p>
        </Link>
      </div>
    </div>
  );
}

function NetWorthSection({ data }: { data: NetWorth }) {
  const { currency, byBucket, liabilities, netWorth } = data;
  return (
    <section className="card form-section-gap">
      <h2 className="section-title">Net worth ({currency})</h2>
      <p className="kpi-highlight">{formatMoney(netWorth, currency)}</p>
      <p className="muted">
        Cash balances by account type. Holdings valuations are not included yet.
        Liabilities: {formatMoney(liabilities, currency)}.
      </p>
      <ul className="stat-list">
        {BUCKET_LABELS.map(({ key, label }) => (
          <li key={key} className="stat-row">
            <span className="stat-row-label">{label}</span>
            <span className="stat-row-value">
              {formatMoney(byBucket[key], currency)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RollingCashflowKpis({ data }: { data: CashflowRolling12m }) {
  const { currency, fromMonth, toMonth, avgIncome, avgExpense, avgNet } = data;
  return (
    <section className="form-section-gap">
      <h2 className="section-title">Rolling 12-month cashflow ({currency})</h2>
      <p className="muted period-filter-summary">
        Averages for complete UTC months {fromMonth} → {toMonth} (excludes the
        current month).
      </p>
      <div className="kpi-grid">
        <div className="kpi-card">
          <h3>Avg income</h3>
          <p className="stat-row-value positive">
            {formatMoney(avgIncome, currency)}
          </p>
        </div>
        <div className="kpi-card">
          <h3>Avg expense</h3>
          <p className="stat-row-value negative">
            {formatMoney(avgExpense, currency)}
          </p>
        </div>
        <div className="kpi-card">
          <h3>Avg net</h3>
          <p
            className={`stat-row-value ${avgNet >= 0 ? "positive" : "negative"}`}
          >
            {formatMoney(avgNet, currency)}
          </p>
        </div>
      </div>
    </section>
  );
}
