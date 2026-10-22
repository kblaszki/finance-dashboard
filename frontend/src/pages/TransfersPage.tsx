import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import { fetchAccounts, type Account } from "../api/accountsApi";
import {
  fetchCategories,
  type Category,
} from "../api/categoriesApi";
import {
  createTransfer,
  deleteTransfer,
  exportTransfersCsv,
  fetchTransfers,
  importTransfersCsv,
  previewTransfersImport,
  updateTransfer,
  type CashTransfer,
  type CreateTransferInput,
  type TransferAccountMapping,
  type TransferAccountPreview,
  type TransferImportRowPreview,
  type UpdateTransferInput,
} from "../api/transfersApi";
import {
  dateInputToIso,
  defaultOccurredAtValue,
  formatOccurredAt,
  toDateLocalValue,
} from "../components/account/occurredAt";
import { categoriesForLedgerType } from "../components/account/categoryScope";
import { AccountLedgerHeader } from "../components/account/AccountLedgerHeader";
import { TransferImportPanel } from "../components/transfers/TransferImportPanel";
import { PageHeader } from "../components/ui/PageHeader";
import { StatusBlock } from "../components/ui/StatusBlock";
import { useAsyncData } from "../hooks/useAsyncData";
import { useCurrency } from "../state/currency";
import { formatMoney } from "../utils/format";

type PendingTransferImport = {
  csv: string;
  rowCount: number;
  accounts: TransferAccountPreview[];
  rows: TransferImportRowPreview[] | null;
  mappings: TransferAccountMapping[] | null;
};

type EditableField =
  | "occurredAt"
  | "fromAccountId"
  | "toAccountId"
  | "amountFrom"
  | "amountTo"
  | "categoryId"
  | "description";

type EditingState = { transferId: number; field: EditableField };

function accountLabel(account: Account): string {
  return `${account.name} (${account.currency})`;
}

function categoryNameById(
  categories: Category[],
  categoryId: number | null,
): string {
  if (categoryId == null) return "—";
  return categories.find((c) => c.id === categoryId)?.name ?? "—";
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
  transferCategories: Category[];
  onCreate: (input: CreateTransferInput) => Promise<void>;
  onActionError: (message: string | null) => void;
}) {
  const [occurredAt, setOccurredAt] = useState(defaultOccurredAtValue);
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [amountFrom, setAmountFrom] = useState("");
  const [amountTo, setAmountTo] = useState("");
  const [categoryId, setCategoryId] = useState("");
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
    let occurredAtIso: string;
    try {
      occurredAtIso = dateInputToIso(occurredAt);
    } catch {
      props.onActionError("Invalid date");
      return;
    }

    const input: CreateTransferInput = {
      fromAccountId: fromId,
      toAccountId: toId,
      amountFrom: amountFromNumber,
      occurredAt: occurredAtIso,
      description: description.trim() ? description.trim() : null,
      categoryId: categoryId === "" ? null : Number(categoryId),
    };
    if (categoryId !== "" && (!Number.isInteger(input.categoryId) || (input.categoryId ?? 0) < 1)) {
      props.onActionError("Invalid category");
      return;
    }
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
      setCategoryId("");
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
      <td className="col-date">
        <input
          ref={dateRef}
          type="date"
          className="ledger-cell-input"
          value={occurredAt}
          disabled={createBusy}
          onChange={(e) => setOccurredAt(e.target.value)}
          onKeyDown={onFieldKeyDown}
          aria-label="New transfer date"
        />
      </td>
      <td className="col-text">
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
      <td className="col-text">
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
      <td className="col-text">
        <select
          className="ledger-cell-input"
          value={categoryId}
          disabled={createBusy}
          onChange={(e) => setCategoryId(e.target.value)}
          onKeyDown={onFieldKeyDown}
          aria-label="New category"
        >
          <option value="">No category</option>
          {props.transferCategories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </td>
      <td className="col-text">
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
      <td className="col-actions">
        <form className="form-actions-row" onSubmit={onFormSubmit}>
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
      return toDateLocalValue(transfer.occurredAt);
    case "fromAccountId":
      return String(transfer.fromAccountId);
    case "toAccountId":
      return String(transfer.toAccountId);
    case "amountFrom":
      return String(transfer.amountFrom);
    case "amountTo":
      return String(transfer.amountTo);
    case "categoryId":
      return transfer.categoryId == null ? "" : String(transfer.categoryId);
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
      return { occurredAt: dateInputToIso(draft) };
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
    case "categoryId": {
      if (draft === "") return { categoryId: null };
      const id = Number(draft);
      if (!Number.isInteger(id) || id < 1) throw new Error("Invalid category");
      return { categoryId: id };
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
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [draft, setDraft] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [pendingImport, setPendingImport] =
    useState<PendingTransferImport | null>(null);
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
    reload: reloadAccounts,
  } = useAsyncData(loadAccounts);

  const loadCategories = useCallback(() => fetchCategories(), []);
  const {
    data: categories,
    error: categoriesError,
    loading: categoriesLoading,
  } = useAsyncData(loadCategories);

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

  const transferCategories = useMemo(
    () => categoriesForLedgerType(categories ?? [], "TRANSFER"),
    [categories],
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

  async function handleExportCsv() {
    setActionError(null);
    setImportMsg(null);
    setExportBusy(true);
    try {
      const blob = await exportTransfersCsv();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "transfers.csv";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExportBusy(false);
    }
  }

  async function handleImportCsvFile(file: File) {
    setActionError(null);
    setImportMsg(null);
    setPendingImport(null);
    setImportBusy(true);
    try {
      const csv = await file.text();
      const preview = await previewTransfersImport(csv);
      if (preview.rowCount === 0) {
        setImportMsg("No transfers in the CSV.");
        return;
      }
      setPendingImport({
        csv,
        rowCount: preview.rowCount,
        accounts: preview.accounts,
        rows: null,
        mappings: null,
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImportBusy(false);
    }
  }

  async function handleImportContinue(mappings: TransferAccountMapping[]) {
    if (!pendingImport) return;
    setImportBusy(true);
    setActionError(null);
    try {
      const preview = await previewTransfersImport(
        pendingImport.csv,
        mappings,
      );
      setPendingImport({
        ...pendingImport,
        accounts: preview.accounts,
        rows: preview.rows ?? [],
        mappings,
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImportBusy(false);
    }
  }

  async function handleImportConfirm(
    mappings: TransferAccountMapping[],
    skipRows: number[],
  ) {
    if (!pendingImport) return;
    setImportBusy(true);
    setActionError(null);
    setImportMsg(null);
    try {
      const result = await importTransfersCsv(
        pendingImport.csv,
        mappings,
        skipRows,
      );
      setImportMsg(
        `Imported ${result.created} transfer(s); skipped ${result.skipped}.`,
      );
      setPendingImport(null);
      reloadTransfers();
      reloadAccounts();
      refreshAccounts();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImportBusy(false);
    }
  }

  const loading = transfersLoading || accountsLoading || categoriesLoading;
  const error = transfersError ?? accountsError ?? categoriesError;

  return (
    <>
      <PageHeader
        title="Transfers"
        subtitle="Move cash between your accounts. Ledger legs stay read-only."
        actions={
          <AccountLedgerHeader
            exportBusy={exportBusy}
            importBusy={importBusy}
            onExport={() => void handleExportCsv()}
            onImportFile={handleImportCsvFile}
          />
        }
      />
      {actionError && <p className="error-banner">{actionError}</p>}
      {importMsg && <p className="success-banner">{importMsg}</p>}
      {pendingImport && (
        <TransferImportPanel
          key={pendingImport.csv.slice(0, 120)}
          accountsPreview={pendingImport.accounts}
          ownedAccounts={accounts ?? []}
          rowCount={pendingImport.rowCount}
          rows={pendingImport.rows}
          busy={importBusy}
          accountById={accountById}
          onContinue={(mappings) => {
            void handleImportContinue(mappings);
          }}
          onImport={(mappings, skipRows) => {
            void handleImportConfirm(mappings, skipRows);
          }}
          onCancel={() => setPendingImport(null)}
        />
      )}
      <StatusBlock
        loading={loading}
        error={error}
        empty={false}
        loadingMessage="Loading transfers…"
      />
      {!loading && !error && (accounts?.length ?? 0) === 0 && (
        <p className="empty-state" role="status">
          No accounts yet.{" "}
          <Link to="/accounts">Create an account</Link> before recording
          transfers.
        </p>
      )}
      {!loading && !error && (accounts?.length ?? 0) > 0 && (
        <section className="card form-section-gap">
          <div className="table-wrap">
            <table className="data-table ledger-table ledger-table--transfers">
              <thead>
                <tr>
                  <th className="col-date">Date</th>
                  <th className="col-text">From</th>
                  <th className="col-text">To</th>
                  <th className="num">Amount from</th>
                  <th className="num">Amount to</th>
                  <th className="num">FX rate</th>
                  <th className="col-text">Category</th>
                  <th className="col-text">Description</th>
                  <th className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                <TransferCreateRow
                  accounts={sortedAccounts}
                  transferCategories={transferCategories}
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
                      className={cellClass(transfer.id, "occurredAt", true, "col-date")}
                      onDoubleClick={() => startEdit(transfer, "occurredAt")}
                    >
                      {isEditing(transfer.id, "occurredAt") ? (
                        <input
                          type="date"
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
                      className={cellClass(transfer.id, "fromAccountId", true, "col-text")}
                      title={
                        fromAccount
                          ? accountLabel(fromAccount)
                          : `#${transfer.fromAccountId}`
                      }
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
                      className={cellClass(transfer.id, "toAccountId", true, "col-text")}
                      title={
                        toAccount
                          ? accountLabel(toAccount)
                          : `#${transfer.toAccountId}`
                      }
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
                        ? transfer.fxRate.toLocaleString(undefined, {
                            maximumFractionDigits: 4,
                          })
                        : "—"}
                    </td>
                    <td
                      className={cellClass(transfer.id, "categoryId", true, "col-text")}
                      onDoubleClick={() => startEdit(transfer, "categoryId")}
                    >
                      {isEditing(transfer.id, "categoryId") ? (
                        <select
                          className="ledger-cell-input"
                          value={draft}
                          disabled={editBusy}
                          autoFocus
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => onEditorKeyDown(e, transfer)}
                          onBlur={onEditorBlur}
                          aria-label="Edit category"
                        >
                          <option value="">No category</option>
                          {transferCategories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        categoryNameById(transferCategories, transfer.categoryId)
                      )}
                    </td>
                    <td
                      className={cellClass(transfer.id, "description", true, "col-text")}
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
                    <td className="col-actions">
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
        </section>
      )}
    </>
  );
}
