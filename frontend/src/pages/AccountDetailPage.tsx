import { FormEvent, useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchAccount, type Account } from "../api/accountsApi";
import {
  CASH_TX_TYPES,
  createTransaction,
  deleteTransaction,
  fetchTransactions,
  type CashTxType,
  type CashTransaction,
} from "../api/transactionsApi";
import { useAsyncData } from "../hooks/useAsyncData";
import { formatMoney } from "../utils/format";

export function AccountDetailPage() {
  const { id } = useParams();
  const accountId = Number(id);

  const loadAccount = useCallback(() => {
    if (!Number.isFinite(accountId) || accountId < 1) {
      return Promise.reject(new Error("Invalid account"));
    }
    return fetchAccount(accountId);
  }, [accountId]);

  const loadTx = useCallback(() => {
    if (!Number.isFinite(accountId) || accountId < 1) {
      return Promise.reject(new Error("Invalid account"));
    }
    return fetchTransactions(accountId);
  }, [accountId]);

  const {
    data: account,
    error: accountError,
    loading: accountLoading,
    reload: reloadAccount,
  } = useAsyncData(loadAccount);

  const {
    data: transactions,
    error: txError,
    loading: txLoading,
    reload: reloadTx,
  } = useAsyncData(loadTx);

  const [type, setType] = useState<CashTxType>("INCOME");
  const [amount, setAmount] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [description, setDescription] = useState("");
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);

  async function refresh() {
    reloadAccount();
    reloadTx();
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateErr(null);
    setCreateBusy(true);
    try {
      const value = Number(amount);
      await createTransaction(accountId, {
        type,
        amount: value,
        occurredAt: occurredAt.trim() ? new Date(occurredAt).toISOString() : undefined,
        description: description.trim() ? description.trim() : null,
      });
      setAmount("");
      setOccurredAt("");
      setDescription("");
      setType("INCOME");
      await refresh();
    } catch (err) {
      setCreateErr(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreateBusy(false);
    }
  }

  async function handleDelete(tx: CashTransaction) {
    if (!window.confirm(`Delete ${tx.type} of ${tx.amount}?`)) return;
    setActionErr(null);
    try {
      await deleteTransaction(accountId, tx.id);
      await refresh();
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : "Delete failed");
    }
  }

  if (!Number.isFinite(accountId) || accountId < 1) {
    return (
      <div className="page-stack">
        <p className="error-banner">Invalid account id.</p>
        <p className="page-back-link">
          <Link to="/accounts">Back to accounts</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <p className="page-back-link">
        <Link to="/accounts">← Accounts</Link>
      </p>

      {accountLoading && <p className="muted">Loading account…</p>}
      {accountError && <p className="error-banner">{accountError}</p>}
      {account && <AccountSummary account={account} />}

      <section className="card form-section-gap">
        <h2 className="section-title">Add cash movement</h2>
        <form className="auth-form" onSubmit={handleCreate}>
          <label>
            Type
            <select
              value={type}
              onChange={(e) => setType(e.target.value as CashTxType)}
            >
              {CASH_TX_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            Amount
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label>
            Date (optional)
            <input
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
            />
          </label>
          <label>
            Description (optional)
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          {createErr && <p className="auth-error">{createErr}</p>}
          <button type="submit" className="btn-primary" disabled={createBusy}>
            {createBusy ? "Saving…" : "Add transaction"}
          </button>
        </form>
      </section>

      <section className="card form-section-gap">
        <h2 className="section-title">Ledger</h2>
        {txLoading && <p className="muted">Loading…</p>}
        {txError && <p className="error-banner">{txError}</p>}
        {actionErr && <p className="error-banner">{actionErr}</p>}
        {!txLoading && !txError && transactions && transactions.length === 0 && (
          <p className="empty-state">No transactions yet.</p>
        )}
        {!txLoading && transactions && transactions.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Description</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td>{formatOccurredAt(tx.occurredAt)}</td>
                    <td>{tx.type}</td>
                    <td>
                      {account
                        ? formatMoney(tx.amount, account.currency)
                        : tx.amount}
                    </td>
                    <td>{tx.description ?? "—"}</td>
                    <td>
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() => void handleDelete(tx)}
                      >
                        Delete
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

function AccountSummary({ account }: { account: Account }) {
  return (
    <section className="card form-section-gap">
      <h1 className="page-title">{account.name}</h1>
      <p className="muted">
        {account.accountType} · Balance{" "}
        <strong>{formatMoney(account.cashBalance, account.currency)}</strong>
      </p>
      {account.description && <p className="muted">{account.description}</p>}
    </section>
  );
}

function formatOccurredAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}
