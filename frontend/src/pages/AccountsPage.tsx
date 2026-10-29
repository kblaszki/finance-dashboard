import {
  type FormEvent,
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import {
  ACCOUNT_CURRENCIES,
  ACCOUNT_TYPES,
  accountTypeLabel,
  createAccount,
  deleteAccount,
  updateAccount,
  type Account,
  type AccountCurrency,
  type AccountType,
} from "../api/accountsApi";
import { fetchTransactions } from "../api/transactionsApi";
import { PageHeader } from "../components/ui/PageHeader";
import { SortableTh } from "../components/ui/SortableTh";
import { StatusBlock } from "../components/ui/StatusBlock";
import { useCurrency } from "../state/currency";
import { formatMoney } from "../utils/format";
import {
  sortBy,
  toggleSort,
  type SortState,
} from "../utils/tableSort";

type AccountSortKey = "name" | "balance";

export type AccountTypeFilter = "ALL" | AccountType;

export function filterAccountsByType(
  accounts: Account[],
  typeFilter: AccountTypeFilter,
): Account[] {
  if (typeFilter === "ALL") return accounts;
  return accounts.filter((a) => a.accountType === typeFilter);
}

export function AccountsPage() {
  const {
    accounts,
    accountsError,
    accountsLoading,
    refreshAccounts,
  } = useCurrency();

  const [typeFilter, setTypeFilter] = useState<AccountTypeFilter>("ALL");
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("BANK");
  const [currency, setCurrency] = useState<AccountCurrency>("PLN");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [description, setDescription] = useState("");
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editCurrency, setEditCurrency] = useState("PLN");
  const [currencyLocked, setCurrencyLocked] = useState(false);
  const [editDescription, setEditDescription] = useState("");
  const [editErr, setEditErr] = useState<string | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const editNameRef = useRef<HTMLInputElement>(null);
  const editRequest = useRef(0);

  useEffect(() => {
    if (editingId == null) return;
    editNameRef.current?.focus({ preventScroll: true });
  }, [editingId]);

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
    const request = editRequest.current + 1;
    editRequest.current = request;
    setEditingId(account.id);
    setEditName(account.name);
    setEditCurrency(account.currency);
    setCurrencyLocked(false);
    setEditDescription(account.description ?? "");
    setEditErr(null);
    setActionErr(null);
    void fetchTransactions(account.id, { limit: 1 })
      .then((page) => {
        if (editRequest.current !== request) return;
        setCurrencyLocked(page.items.length > 0);
      })
      .catch(() => {
        if (editRequest.current !== request) return;
        setCurrencyLocked(true);
      });
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
        currency: currencyLocked ? undefined : editCurrency,
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

  const [sort, setSort] = useState<SortState<AccountSortKey> | null>(null);
  const filteredAccounts = useMemo(
    () => filterAccountsByType(accounts ?? [], typeFilter),
    [accounts, typeFilter],
  );
  const sortedAccounts = useMemo(
    () =>
      sortBy(filteredAccounts, sort, {
        name: (a) => a.name,
        balance: (a) => a.cashBalance,
      }),
    [filteredAccounts, sort],
  );

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
                    {accountTypeLabel(type)}
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
              <select
                required
                value={currency}
                onChange={(e) =>
                  setCurrency(e.target.value as AccountCurrency)
                }
              >
                {ACCOUNT_CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Opening balance
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
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
          emptyMessage={
            <>
              No accounts yet.{" "}
              <button
                type="button"
                className="link-button"
                onClick={() => setShowCreate(true)}
              >
                Create your first account
              </button>
            </>
          }
        />
        {!accountsLoading && accounts && accounts.length > 0 && (
          <>
            <label className="accounts-type-filter">
              Type
              <select
                className="field-control"
                aria-label="Filter by type"
                value={typeFilter}
                onChange={(e) =>
                  setTypeFilter(e.target.value as AccountTypeFilter)
                }
              >
                <option value="ALL">All</option>
                {ACCOUNT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {accountTypeLabel(type)}
                  </option>
                ))}
              </select>
            </label>
            {filteredAccounts.length === 0 ? (
              <p className="empty-state">No accounts of this type.</p>
            ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <SortableTh
                    label="Name"
                    sortKey="name"
                    sort={sort}
                    onToggle={(key) => setSort((prev) => toggleSort(prev, key))}
                  />
                  <th>Type</th>
                  <SortableTh
                    label="Balance"
                    sortKey="balance"
                    sort={sort}
                    onToggle={(key) => setSort((prev) => toggleSort(prev, key))}
                    className="num"
                  />
                  <th className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedAccounts.map((account) => (
                  <Fragment key={account.id}>
                    <tr>
                      <td>
                        <div>
                          <Link to={`/accounts/${account.id}`}>
                            {account.name}
                          </Link>
                        </div>
                        {account.description && (
                          <div className="muted">{account.description}</div>
                        )}
                      </td>
                      <td>
                        <span className="badge">
                          {accountTypeLabel(account.accountType)}
                        </span>
                      </td>
                      <td className="num">
                        {formatMoney(account.totalBalance, account.currency)}
                      </td>
                      <td className="col-actions">
                        {editingId !== account.id ? (
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
                              aria-label={`Edit ${account.name}`}
                              onClick={() => startEdit(account)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn-danger"
                              aria-label={`Delete ${account.name}`}
                              onClick={() => void handleDelete(account)}
                            >
                              Delete
                            </button>
                          </div>
                        ) : (
                          <span className="muted">Editing…</span>
                        )}
                      </td>
                    </tr>
                    {editingId === account.id && (
                      <tr className="account-edit-row">
                        <td colSpan={4}>
                          <form
                            className="auth-form auth-form--compact"
                            onSubmit={handleSaveEdit}
                          >
                            <label>
                              Name
                              <input
                                ref={editNameRef}
                                type="text"
                                required
                                value={editName}
                                aria-invalid={editErr ? true : undefined}
                                onChange={(e) => setEditName(e.target.value)}
                              />
                            </label>
                            <label>
                              Currency
                              <select
                                required
                                value={editCurrency}
                                disabled={currencyLocked}
                                aria-invalid={editErr ? true : undefined}
                                onChange={(e) =>
                                  setEditCurrency(e.target.value)
                                }
                              >
                                {ACCOUNT_CURRENCIES.map((code) => (
                                  <option key={code} value={code}>
                                    {code}
                                  </option>
                                ))}
                              </select>
                            </label>
                            {currencyLocked && (
                              <p className="muted">
                                Currency is locked because this account has
                                transactions.
                              </p>
                            )}
                            <label>
                              Description
                              <input
                                type="text"
                                value={editDescription}
                                onChange={(e) =>
                                  setEditDescription(e.target.value)
                                }
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
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
