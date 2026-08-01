import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import {
  ACCOUNT_TYPES,
  createAccount,
  deleteAccount,
  updateAccount,
  type Account,
  type AccountType,
} from "../api/accountsApi";
import { PageHeader } from "../components/ui/PageHeader";
import { StatusBlock } from "../components/ui/StatusBlock";
import { useCurrency } from "../state/currency";
import { formatMoney } from "../utils/format";

export function AccountsPage() {
  const {
    accounts,
    accountsError,
    accountsLoading,
    refreshAccounts,
  } = useCurrency();

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("BANK");
  const [currency, setCurrency] = useState("PLN");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [description, setDescription] = useState("");
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editErr, setEditErr] = useState<string | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateErr(null);
    setCreateBusy(true);
    try {
      const balance = Number(openingBalance);
      await createAccount({
        name,
        currency,
        openingBalance: Number.isFinite(balance) ? balance : 0,
        description: description.trim() ? description.trim() : null,
        accountType,
      });
      setName("");
      setAccountType("BANK");
      setCurrency("PLN");
      setOpeningBalance("0");
      setDescription("");
      setShowCreate(false);
      refreshAccounts();
    } catch (err) {
      setCreateErr(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreateBusy(false);
    }
  }

  function startEdit(account: Account) {
    setEditingId(account.id);
    setEditName(account.name);
    setEditDescription(account.description ?? "");
    setEditErr(null);
    setActionErr(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditErr(null);
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (editingId == null) return;
    setEditErr(null);
    setEditBusy(true);
    try {
      await updateAccount(editingId, {
        name: editName,
        description: editDescription.trim() ? editDescription.trim() : null,
      });
      setEditingId(null);
      refreshAccounts();
    } catch (err) {
      setEditErr(err instanceof Error ? err.message : "Update failed");
    } finally {
      setEditBusy(false);
    }
  }

  async function handleDelete(account: Account) {
    if (!window.confirm(`Delete account "${account.name}"?`)) return;
    setActionErr(null);
    try {
      await deleteAccount(account.id);
      if (editingId === account.id) setEditingId(null);
      refreshAccounts();
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <>
      <PageHeader
        title="Accounts"
        subtitle="Opening balance seeds cash. Open a ledger for income and expense moves."
        actions={
          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowCreate((v) => !v)}
          >
            {showCreate ? "Hide form" : "Add account"}
          </button>
        }
      />

      {showCreate && (
        <section className="card form-section-gap">
          <h2 className="section-title">Add account</h2>
          <form className="auth-form" onSubmit={handleCreate}>
            <label>
              Type
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value as AccountType)}
              >
                {ACCOUNT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Name
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              Currency
              <input
                type="text"
                required
                minLength={3}
                maxLength={3}
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              />
            </label>
            <label>
              Opening balance
              <input
                type="number"
                step="0.01"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
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
              {createBusy ? "Creating…" : "Create account"}
            </button>
          </form>
        </section>
      )}

      <section className="card form-section-gap">
        <h2 className="section-title">Your accounts</h2>
        {actionErr && <p className="error-banner">{actionErr}</p>}
        <StatusBlock
          loading={accountsLoading}
          error={accountsError}
          empty={!accountsLoading && !accountsError && (accounts?.length ?? 0) === 0}
          loadingMessage="Loading accounts…"
          emptyMessage="No accounts yet."
        />
        {!accountsLoading && accounts && accounts.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th className="num">Balance</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id}>
                    <td>
                      {editingId === account.id ? (
                        <form
                          className="auth-form auth-form--compact"
                          onSubmit={handleSaveEdit}
                        >
                          <label>
                            Name
                            <input
                              type="text"
                              required
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                            />
                          </label>
                          <label>
                            Description
                            <input
                              type="text"
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                            />
                          </label>
                          {editErr && <p className="auth-error">{editErr}</p>}
                          <div className="form-actions-row">
                            <button
                              type="submit"
                              className="btn-primary"
                              disabled={editBusy}
                            >
                              {editBusy ? "Saving…" : "Save"}
                            </button>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={cancelEdit}
                              disabled={editBusy}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <div>
                            <Link to={`/accounts/${account.id}`}>
                              {account.name}
                            </Link>
                          </div>
                          {account.description && (
                            <div className="muted">{account.description}</div>
                          )}
                        </>
                      )}
                    </td>
                    <td>
                      <span className="badge">{account.accountType}</span>
                    </td>
                    <td className="num">
                      {formatMoney(account.totalBalance, account.currency)}
                    </td>
                    <td>
                      {editingId !== account.id && (
                        <div className="form-actions-row">
                          <Link
                            to={`/accounts/${account.id}`}
                            className="btn-secondary"
                          >
                            Ledger
                          </Link>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => startEdit(account)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn-danger"
                            onClick={() => void handleDelete(account)}
                          >
                            Delete
                          </button>
                        </div>
                      )}
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
