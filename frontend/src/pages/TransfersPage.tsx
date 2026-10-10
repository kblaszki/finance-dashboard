import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { fetchAccounts, type Account } from "../api/accountsApi";
import {
  createTransfer,
  deleteTransfer,
  fetchTransfers,
  updateTransfer,
  type CashTransfer,
  type CreateTransferInput,
  type UpdateTransferInput,
} from "../api/transfersApi";
import {
  defaultOccurredAtValue,
  formatOccurredAt,
  toDateTimeLocalValue,
} from "../components/account/occurredAt";
import { PageHeader } from "../components/ui/PageHeader";
import { StatusBlock } from "../components/ui/StatusBlock";
import { useAsyncData } from "../hooks/useAsyncData";
import { useCurrency } from "../state/currency";
import { formatMoney } from "../utils/format";

type EditableField =
  | "occurredAt"
  | "fromAccountId"
  | "toAccountId"
  | "amountFrom"
  | "amountTo"
  | "description";

type EditingState = { transferId: number; field: EditableField };

function accountLabel(account: Account): string {
  return `${account.name} (${account.currency})`;
}

function currencyForAccount(
  accounts: Account[],
  accountId: number | string,
): string | null {
  const id = Number(accountId);
  if (!Number.isInteger(id)) return null;
  return accounts.find((a) => a.id === id)?.currency ?? null;
}

function TransferCreateRow(props: {
  accounts: Account[];
  onCreate: (input: CreateTransferInput) => Promise<void>;
  onActionError: (message: string | null) => void;
}) {
  const [occurredAt, setOccurredAt] = useState(defaultOccurredAtValue);
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [amountFrom, setAmountFrom] = useState("");
  const [amountTo, setAmountTo] = useState("");
  const [description, setDescription] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [focusNonce, setFocusNonce] = useState(0);
  const dateRef = useRef<HTMLInputElement | null>(null);

  const fromCurrency = currencyForAccount(props.accounts, fromAccountId);
  const toCurrency = currencyForAccount(props.accounts, toAccountId);
  const crossCurrency =
    fromCurrency != null && toCurrency != null && fromCurrency !== toCurrency;

  useEffect(() => {
    if (focusNonce === 0) return;
    const id = window.setTimeout(() => {
      dateRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(id);
  }, [focusNonce]);

  async function submit() {
    props.onActionError(null);
    const fromId = Number(fromAccountId);
    const toId = Number(toAccountId);
    if (!Number.isInteger(fromId) || fromId < 1) {
      props.onActionError("From account required");
      return;
    }
    if (!Number.isInteger(toId) || toId < 1) {
      props.onActionError("To account required");
      return;
    }
    const amountFromNumber = Number(amountFrom);
    if (!Number.isFinite(amountFromNumber) || amountFromNumber <= 0) {
      props.onActionError("Amount from must be a positive number");
      return;
    }
    const date = new Date(occurredAt);
    if (Number.isNaN(date.getTime())) {
      props.onActionError("Invalid date");
      return;
    }

    const input: CreateTransferInput = {
      fromAccountId: fromId,
      toAccountId: toId,
      amountFrom: amountFromNumber,
      occurredAt: date.toISOString(),
      description: description.trim() ? description.trim() : null,
    };
    if (crossCurrency) {
      const amountToNumber = Number(amountTo);
      if (!Number.isFinite(amountToNumber) || amountToNumber <= 0) {
        props.onActionError("Amount to required when currencies differ");
        return;
      }
      input.amountTo = amountToNumber;
    }

    setCreateBusy(true);
    try {
      await props.onCreate(input);
      setOccurredAt(defaultOccurredAtValue());
      setFromAccountId("");
      setToAccountId("");
      setAmountFrom("");
      setAmountTo("");
      setDescription("");
      setCreateBusy(false);
      setFocusNonce((n) => n + 1);
    } catch (err) {
      props.onActionError(err instanceof Error ? err.message : "Create failed");
      setCreateBusy(false);
    }
  }

  function onFormSubmit(e: FormEvent) {
    e.preventDefault();
    void submit();
  }

  function onFieldKeyDown(e: KeyboardEvent) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    void submit();
  }

  return (
    <tr className="ledger-create-row">
      <td>
        <input
          ref={dateRef}
          type="datetime-local"
          className="ledger-cell-input"
          value={occurredAt}
          disabled={createBusy}
          onChange={(e) => setOccurredAt(e.target.value)}
          onKeyDown={onFieldKeyDown}
          aria-label="New transfer date"
        />
      </td>
      <td>
        <select
          className="ledger-cell-input"
          value={fromAccountId}
          disabled={createBusy}
          onChange={(e) => setFromAccountId(e.target.value)}
          onKeyDown={onFieldKeyDown}
          aria-label="New from account"
        >
          <option value="">From…</option>
          {props.accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {accountLabel(account)}
            </option>
          ))}
        </select>
      </td>
      <td>
        <select
          className="ledger-cell-input"
          value={toAccountId}
          disabled={createBusy}
          onChange={(e) => setToAccountId(e.target.value)}
          onKeyDown={onFieldKeyDown}
          aria-label="New to account"
        >
          <option value="">To…</option>
          {props.accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {accountLabel(account)}
            </option>
          ))}
        </select>
      </td>
      <td className="num">
        <input
          type="number"
          step="0.01"
          min="0.01"
          inputMode="decimal"
          className="ledger-cell-input"
          value={amountFrom}
          disabled={createBusy}
          onChange={(e) => setAmountFrom(e.target.value)}
          onKeyDown={onFieldKeyDown}
          aria-label="New amount from"
          placeholder={fromCurrency ?? "Amount"}
        />
      </td>
      <td className="num">
        <input
          type="number"
          step="0.01"
          min="0.01"
          inputMode="decimal"
          className="ledger-cell-input"
          value={crossCurrency ? amountTo : amountFrom}
          disabled={createBusy || !crossCurrency}
          onChange={(e) => setAmountTo(e.target.value)}
          onKeyDown={onFieldKeyDown}
          aria-label="New amount to"
          placeholder={toCurrency ?? "Amount to"}
        />
      </td>
      <td className="num">—</td>
      <td>
        <input
          type="text"
          className="ledger-cell-input"
          value={description}
          disabled={createBusy}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={onFieldKeyDown}
          aria-label="New description"
          placeholder="Description"
        />
      </td>
      <td>
        <form onSubmit={onFormSubmit}>
          <button type="submit" className="btn-primary" disabled={createBusy}>
            Add
          </button>
        </form>
      </td>
    </tr>
  );
}

function draftFromTransfer(transfer: CashTransfer, field: EditableField): string {
  switch (field) {
    case "occurredAt":
      return toDateTimeLocalValue(transfer.occurredAt);
    case "fromAccountId":
      return String(transfer.fromAccountId);
    case "toAccountId":
      return String(transfer.toAccountId);
    case "amountFrom":
      return String(transfer.amountFrom);
    case "amountTo":
      return String(transfer.amountTo);
    case "description":
      return transfer.description ?? "";
  }
}

function buildPatch(
  field: EditableField,
  draft: string,
): UpdateTransferInput {
  switch (field) {
    case "occurredAt": {
      const date = new Date(draft);
      if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
      return { occurredAt: date.toISOString() };
    }
    case "fromAccountId": {
      const id = Number(draft);
      if (!Number.isInteger(id) || id < 1) throw new Error("Invalid from account");
      return { fromAccountId: id };
    }
    case "toAccountId": {
      const id = Number(draft);
      if (!Number.isInteger(id) || id < 1) throw new Error("Invalid to account");
      return { toAccountId: id };
    }
    case "amountFrom": {
      const amount = Number(draft);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Amount from must be a positive number");
      }
      return { amountFrom: amount };
    }
    case "amountTo": {
      const amount = Number(draft);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Amount to must be a positive number");
      }
      return { amountTo: amount };
    }
    case "description": {
      const trimmed = draft.trim();
      return { description: trimmed ? trimmed : null };
    }
  }
}

export function TransfersPage() {
  const { refreshAccounts } = useCurrency();
  const [actionError, setActionError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [draft, setDraft] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const committingRef = useRef(false);

  const loadTransfers = useCallback(() => fetchTransfers(), []);
  const {
    data: transfers,
    error: transfersError,
    loading: transfersLoading,
    reload: reloadTransfers,
  } = useAsyncData(loadTransfers);

  const loadAccounts = useCallback(() => fetchAccounts(), []);
  const {
    data: accounts,
    error: accountsError,
    loading: accountsLoading,
  } = useAsyncData(loadAccounts);

  const accountById = useMemo(() => {
    const map = new Map<number, Account>();
    for (const account of accounts ?? []) map.set(account.id, account);
    return map;
  }, [accounts]);

  const sortedAccounts = useMemo(
    () =>
      (accounts ?? [])
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [accounts],
  );

  function startEdit(transfer: CashTransfer, field: EditableField) {
    if (editBusy) return;
    if (
      field === "amountTo" &&
      transfer.fromCurrency === transfer.toCurrency
    ) {
      return;
    }
    setEditing({ transferId: transfer.id, field });
    setDraft(draftFromTransfer(transfer, field));
    setActionError(null);
  }

  function cancelEdit() {
    setEditing(null);
    setDraft("");
  }

  function onEditorBlur() {
    window.setTimeout(() => {
      if (!committingRef.current) cancelEdit();
    }, 0);
  }

  async function commitEdit(transfer: CashTransfer) {
    if (!editing || editing.transferId !== transfer.id || editBusy) return;
    setActionError(null);
    committingRef.current = true;
    setEditBusy(true);
    try {
      const patch = buildPatch(editing.field, draft);
      await updateTransfer(transfer.id, patch);
      cancelEdit();
      reloadTransfers();
      refreshAccounts();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Update failed");
    } finally {
      committingRef.current = false;
      setEditBusy(false);
    }
  }

  function onEditorKeyDown(e: KeyboardEvent, transfer: CashTransfer) {
    if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      void commitEdit(transfer);
    }
  }

  function isEditing(transferId: number, field: EditableField): boolean {
    return editing?.transferId === transferId && editing.field === field;
  }

  function cellClass(
    transferId: number,
    field: EditableField,
    editable: boolean,
    extra = "",
  ): string {
    const parts = ["ledger-cell"];
    if (editable) parts.push("ledger-cell--editable");
    if (isEditing(transferId, field)) parts.push("ledger-cell--editing");
    if (extra) parts.push(extra);
    return parts.join(" ");
  }

  async function handleCreate(input: CreateTransferInput) {
    await createTransfer(input);
    reloadTransfers();
    refreshAccounts();
  }

  async function handleDelete(transfer: CashTransfer) {
    const fromName =
      accountById.get(transfer.fromAccountId)?.name ?? `#${transfer.fromAccountId}`;
    const toName =
      accountById.get(transfer.toAccountId)?.name ?? `#${transfer.toAccountId}`;
    const ok = window.confirm(
      `Delete transfer ${formatMoney(transfer.amountFrom, transfer.fromCurrency)} from ${fromName} to ${toName}?`,
    );
    if (!ok) return;
    setActionError(null);
    try {
      await deleteTransfer(transfer.id);
      reloadTransfers();
      refreshAccounts();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  const loading = transfersLoading || accountsLoading;
  const error = transfersError ?? accountsError;

  return (
    <>
      <PageHeader
        title="Transfers"
        subtitle="Move cash between your accounts. Ledger legs stay read-only."
      />
      {actionError && <p className="error-banner">{actionError}</p>}
      <StatusBlock
        loading={loading}
        error={error}
        empty={false}
        loadingMessage="Loading transfers…"
      />
      {!loading && !error && (
        <div className="table-wrap">
          <table className="data-table ledger-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>From</th>
                <th>To</th>
                <th className="num">Amount from</th>
                <th className="num">Amount to</th>
                <th className="num">FX rate</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <TransferCreateRow
                accounts={sortedAccounts}
                onCreate={handleCreate}
                onActionError={setActionError}
              />
              {(transfers ?? []).map((transfer) => {
                const cross = transfer.fromCurrency !== transfer.toCurrency;
                const fromAccount = accountById.get(transfer.fromAccountId);
                const toAccount = accountById.get(transfer.toAccountId);
                return (
                  <tr key={transfer.id}>
                    <td
                      className={cellClass(transfer.id, "occurredAt", true)}
                      onDoubleClick={() => startEdit(transfer, "occurredAt")}
                    >
                      {isEditing(transfer.id, "occurredAt") ? (
                        <input
                          type="datetime-local"
                          className="ledger-cell-input"
                          value={draft}
                          disabled={editBusy}
                          autoFocus
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => onEditorKeyDown(e, transfer)}
                          onBlur={onEditorBlur}
                          aria-label="Edit date"
                        />
                      ) : (
                        formatOccurredAt(transfer.occurredAt)
                      )}
                    </td>
                    <td
                      className={cellClass(transfer.id, "fromAccountId", true)}
                      onDoubleClick={() => startEdit(transfer, "fromAccountId")}
                    >
                      {isEditing(transfer.id, "fromAccountId") ? (
                        <select
                          className="ledger-cell-input"
                          value={draft}
                          disabled={editBusy}
                          autoFocus
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => onEditorKeyDown(e, transfer)}
                          onBlur={onEditorBlur}
                          aria-label="Edit from account"
                        >
                          {sortedAccounts.map((account) => (
                            <option key={account.id} value={account.id}>
                              {accountLabel(account)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        (fromAccount ? accountLabel(fromAccount) : `#${transfer.fromAccountId}`)
                      )}
                    </td>
                    <td
                      className={cellClass(transfer.id, "toAccountId", true)}
                      onDoubleClick={() => startEdit(transfer, "toAccountId")}
                    >
                      {isEditing(transfer.id, "toAccountId") ? (
                        <select
                          className="ledger-cell-input"
                          value={draft}
                          disabled={editBusy}
                          autoFocus
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => onEditorKeyDown(e, transfer)}
                          onBlur={onEditorBlur}
                          aria-label="Edit to account"
                        >
                          {sortedAccounts.map((account) => (
                            <option key={account.id} value={account.id}>
                              {accountLabel(account)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        (toAccount ? accountLabel(toAccount) : `#${transfer.toAccountId}`)
                      )}
                    </td>
                    <td
                      className={cellClass(transfer.id, "amountFrom", true, "num")}
                      onDoubleClick={() => startEdit(transfer, "amountFrom")}
                    >
                      {isEditing(transfer.id, "amountFrom") ? (
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          inputMode="decimal"
                          className="ledger-cell-input"
                          value={draft}
                          disabled={editBusy}
                          autoFocus
                          onFocus={(e) => e.currentTarget.select()}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => onEditorKeyDown(e, transfer)}
                          onBlur={onEditorBlur}
                          aria-label="Edit amount from"
                        />
                      ) : (
                        formatMoney(transfer.amountFrom, transfer.fromCurrency)
                      )}
                    </td>
                    <td
                      className={cellClass(
                        transfer.id,
                        "amountTo",
                        cross,
                        "num",
                      )}
                      onDoubleClick={() => startEdit(transfer, "amountTo")}
                    >
                      {isEditing(transfer.id, "amountTo") ? (
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          inputMode="decimal"
                          className="ledger-cell-input"
                          value={draft}
                          disabled={editBusy}
                          autoFocus
                          onFocus={(e) => e.currentTarget.select()}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => onEditorKeyDown(e, transfer)}
                          onBlur={onEditorBlur}
                          aria-label="Edit amount to"
                        />
                      ) : (
                        formatMoney(transfer.amountTo, transfer.toCurrency)
                      )}
                    </td>
                    <td className="num">
                      {cross && transfer.fxRate != null
                        ? transfer.fxRate.toFixed(6)
                        : "—"}
                    </td>
                    <td
                      className={cellClass(transfer.id, "description", true)}
                      onDoubleClick={() => startEdit(transfer, "description")}
                    >
                      {isEditing(transfer.id, "description") ? (
                        <input
                          type="text"
                          className="ledger-cell-input"
                          value={draft}
                          disabled={editBusy}
                          autoFocus
                          onFocus={(e) => e.currentTarget.select()}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => onEditorKeyDown(e, transfer)}
                          onBlur={onEditorBlur}
                          aria-label="Edit description"
                        />
                      ) : (
                        (transfer.description ?? "—")
                      )}
                    </td>
                    <td>
                      <div className="form-actions-row">
                        <button
                          type="button"
                          className="btn-danger"
                          onClick={() => void handleDelete(transfer)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
