import { FormEvent, useCallback, useState } from "react";
import {
  createAccount,
  deleteAccount,
  fetchAccounts,
  updateAccount,
  type Account,
} from "../api/accountsApi";
import { useAsyncData } from "../hooks/useAsyncData";
import { formatMoney } from "../utils/format";

export function AccountsPage() {
  const loadAccounts = useCallback(() => fetchAccounts(), []);
  const { data: accounts, error, loading, reload } = useAsyncData(loadAccounts);

  const [name, setName] = useState("");
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
        accountType: "BANK",
      });
      setName("");
      setCurrency("PLN");
      setOpeningBalance("0");
      setDescription("");
      reload();
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
      reload();
    } catch (err) {
      setEditErr(err instanceof Error ? err.message : "Update failed");
    } finally {
      setEditBusy(false);
    }
  }

  async function handleDelete(account: Account) {
    if (!window.confirm(`Delete bank account "${account.name}"?`)) return;
    setActionErr(null);
    try {
      await deleteAccount(account.id);
      if (editingId === account.id) setEditingId(null);
      reload();
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div className="page-stack">
      <h1 className="page-title">Accounts</h1>
      <p className="muted">
        Bank accounts only for now. Opening balance seeds cash; ledger moves
        come later.
      </p>

      <section className="card form-section-gap">
        <h2 className="section-title">Add bank account</h2>
        <form className="auth-form" onSubmit={handleCreate}>
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
            {createBusy ? "Creating…" : "Create bank account"}
          </button>
        </form>
      </section>

      <section className="card form-section-gap">
        <h2 className="section-title">Your accounts</h2>
        {loading && <p className="muted">Loading…</p>}
        {error && <p className="error-banner">{error}</p>}
        {actionErr && <p className="error-banner">{actionErr}</p>}
        {!loading && !error && accounts && accounts.length === 0 && (
          <p className="muted">No accounts yet.</p>
        )}
        {!loading && accounts && accounts.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Balance</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id}>
                    <td>
                      {editingId === account.id ? (
                        <form className="auth-form" onSubmit={handleSaveEdit}>
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
                          <div>{account.name}</div>
                          {account.description && (
                            <div className="muted">{account.description}</div>
                          )}
                        </>
                      )}
                    </td>
                    <td>{account.accountType}</td>
                    <td>{formatMoney(account.totalBalance, account.currency)}</td>
                    <td>
                      {editingId !== account.id && (
                        <div className="form-actions-row">
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => startEdit(account)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
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
    </div>
  );
}
