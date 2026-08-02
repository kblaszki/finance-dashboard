import { FormEvent, useCallback, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchAccount, type Account } from "../api/accountsApi";
import {
  fetchCategories,
  flattenCategoryTree,
} from "../api/categoriesApi";
import {
  CASH_TX_TYPES,
  createTransaction,
  deleteTransaction,
  exportTransactionsCsv,
  fetchTransactions,
  type CashTxType,
  type CashTransaction,
} from "../api/transactionsApi";
import { PageHeader } from "../components/ui/PageHeader";
import { StatusBlock } from "../components/ui/StatusBlock";
import { useAsyncData } from "../hooks/useAsyncData";
import { useCurrency } from "../state/currency";
import { formatMoney } from "../utils/format";

export function AccountDetailPage() {
  const { id } = useParams();
  const accountId = Number(id);
  const { refreshAccounts } = useCurrency();

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

  const loadCategories = useCallback(() => fetchCategories(), []);

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

  const { data: categories } = useAsyncData(loadCategories);

  const categoryRows = useMemo(
    () => (categories ? flattenCategoryTree(categories) : []),
    [categories],
  );

  const categoryNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const cat of categories ?? []) {
      map.set(cat.id, cat.name);
    }
    return map;
  }, [categories]);

  const [showCreate, setShowCreate] = useState(false);
  const [type, setType] = useState<CashTxType>("INCOME");
  const [amount, setAmount] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);

  async function refresh() {
    reloadAccount();
    reloadTx();
    refreshAccounts();
  }

  async function handleExportCsv() {
    setActionErr(null);
    setExportBusy(true);
    try {
      const blob = await exportTransactionsCsv(accountId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const safeName = (account?.name ?? `account-${accountId}`)
        .replace(/[^\w.-]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 64);
      anchor.href = url;
      anchor.download = `${safeName || `account-${accountId}`}-cash.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExportBusy(false);
    }
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
        categoryId: categoryId === "" ? null : Number(categoryId),
      });
      setAmount("");
      setOccurredAt("");
      setDescription("");
      setCategoryId("");
      setType("INCOME");
      setShowCreate(false);
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
      <>
        <p className="error-banner">Invalid account id.</p>
        <p className="page-back-link">
          <Link to="/accounts">Back to accounts</Link>
        </p>
      </>
    );
  }

  return (
    <>
      <p className="page-back-link">
        <Link to="/accounts">← Accounts</Link>
      </p>

      <StatusBlock
        loading={accountLoading}
        error={accountError}
        loadingMessage="Loading account…"
      />

      {account && (
        <PageHeader
          title={account.name}
          subtitle={<AccountSubtitle account={account} />}
          actions={
            <div className="form-actions-row">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void handleExportCsv()}
                disabled={exportBusy}
              >
                {exportBusy ? "Downloading…" : "Download CSV"}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setShowCreate((v) => !v)}
              >
                {showCreate ? "Hide form" : "Add transaction"}
              </button>
            </div>
          }
        />
      )}

      {actionErr && <p className="error-banner">{actionErr}</p>}

      {showCreate && (
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
              Category (optional)
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">— None —</option>
                {categoryRows.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {"\u00A0".repeat(cat.depth * 2)}
                    {cat.name}
                  </option>
                ))}
              </select>
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
      )}

      <section className="card form-section-gap">
        <h2 className="section-title">Ledger</h2>
        <StatusBlock
          loading={txLoading}
          error={txError}
          empty={
            !txLoading && !txError && (transactions?.length ?? 0) === 0
          }
          loadingMessage="Loading ledger…"
          emptyMessage="No transactions yet."
        />
        {!txLoading && transactions && transactions.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th className="num">Amount</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td>{formatOccurredAt(tx.occurredAt)}</td>
                    <td>
                      <span
                        className={`badge ${tx.type === "INCOME" ? "badge-positive" : "badge-negative"}`}
                      >
                        {tx.type}
                      </span>
                    </td>
                    <td className="num">
                      {account
                        ? formatMoney(tx.amount, account.currency)
                        : tx.amount}
                    </td>
                    <td>
                      {tx.categoryId != null ? (
                        <span className="badge">
                          {categoryNameById.get(tx.categoryId) ??
                            `#${tx.categoryId}`}
                        </span>
                      ) : (
                        "—"
                      )}
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
    </>
  );
}

function AccountSubtitle({ account }: { account: Account }) {
  return (
    <>
      <span className="badge">{account.accountType}</span>
      {" · Balance "}
      <strong>{formatMoney(account.cashBalance, account.currency)}</strong>
      {account.openingCashAsOf && (
        <>
          {" · Opening as of "}
          {formatOccurredAt(account.openingCashAsOf)}
        </>
      )}
      {account.description ? ` · ${account.description}` : null}
    </>
  );
}

function formatOccurredAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}
