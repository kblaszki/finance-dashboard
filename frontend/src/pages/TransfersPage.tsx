import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useSearchParams } from "react-router-dom";
import { type Account } from "../api/accountsApi";
import {
  fetchCategories,
  type Category,
} from "../api/categoriesApi";
import {
  createTransfer,
  deleteTransfer,
  exportTransfersCsv,
  fetchTransfers,
  updateTransfer,
  type CashTransfer,
  type CreateTransferInput,
  type UpdateTransferInput,
} from "../api/transfersApi";
import {
  accountLabel,
  TransferCreateRow,
} from "../components/transfers/TransferCreateRow";
import { useTransferImport } from "../hooks/useTransferImport";
import {
  dateInputToIso,
  formatOccurredAt,
  toDateLocalValue,
} from "../components/account/occurredAt";
import { CategorySelectWithCreate } from "../components/account/CategorySelectWithCreate";
import { categoriesForLedgerType } from "../components/account/categoryScope";
import { AccountLedgerHeader } from "../components/account/AccountLedgerHeader";
import { TransferFilterBar } from "../components/transfers/TransferFilterBar";
import { TransferImportPanel } from "../components/transfers/TransferImportPanel";
import {
  MonthPager,
  currentUtcMonth,
  utcMonthFromIso,
  type ListViewMode,
} from "../components/ui/MonthPager";
import { PageHeader } from "../components/ui/PageHeader";
import { SortableTh } from "../components/ui/SortableTh";
import { StatusBlock } from "../components/ui/StatusBlock";
import { useAsyncData } from "../hooks/useAsyncData";
import { useCurrency } from "../state/currency";
import { formatMoney } from "../utils/format";
import {
  EMPTY_TRANSFER_FILTERS,
  filterTransferRows,
  isTransferFilterActive,
  type TransferFilterState,
} from "../utils/listFilters";
import {
  sortBy,
  toggleSort,
  type SortState,
} from "../utils/tableSort";

type TransferSortKey = "occurredAt" | "amountFrom" | "amountTo" | "description";

type EditableField =
  | "occurredAt"
  | "fromAccountId"
  | "toAccountId"
  | "amountFrom"
  | "amountTo"
  | "categoryId"
  | "description";

type EditingState = { transferId: number; field: EditableField };

function categoryNameById(
  categories: Category[],
  categoryId: number | null,
): string {
  if (categoryId == null) return "—";
  return categories.find((c) => c.id === categoryId)?.name ?? "—";
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

function parseFromAccountIdParam(raw: string | null): number | null {
  if (raw == null || raw === "") return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function TransfersPage() {
  const {
    accounts,
    accountsError,
    accountsLoading,
    refreshAccounts,
  } = useCurrency();
  const [searchParams, setSearchParams] = useSearchParams();
  const [seedFromAccountId, setSeedFromAccountId] = useState<number | null>(
    () => parseFromAccountIdParam(searchParams.get("fromAccountId")),
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [draft, setDraft] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const committingRef = useRef(false);
  const [listMode, setListMode] = useState<ListViewMode>("month");
  const [month, setMonth] = useState(currentUtcMonth);
  const [transfers, setTransfers] = useState<CashTransfer[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadMoreBusy, setLoadMoreBusy] = useState(false);
  const [filters, setFilters] = useState<TransferFilterState>({
    ...EMPTY_TRANSFER_FILTERS,
  });

  useEffect(() => {
    if (!searchParams.has("fromAccountId")) return;
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const clearSeedFromAccountId = useCallback(() => {
    setSeedFromAccountId(null);
  }, []);

  const loadTransfers = useCallback(() => {
    if (listMode === "month") {
      return fetchTransfers({ month });
    }
    return fetchTransfers({ limit: 100 });
  }, [listMode, month]);
  const {
    data: transfersPage,
    error: transfersError,
    loading: transfersLoading,
    reload: reloadTransfers,
  } = useAsyncData(loadTransfers);

  useEffect(() => {
    if (!transfersPage) return;
    setTransfers(transfersPage.items);
    setNextCursor(listMode === "all" ? transfersPage.nextCursor : null);
  }, [transfersPage, listMode]);

  const [sort, setSort] = useState<SortState<TransferSortKey> | null>(null);
  const filteredTransfers = useMemo(
    () => filterTransferRows(transfers, filters),
    [transfers, filters],
  );
  const sortedTransfers = useMemo(
    () =>
      sortBy(filteredTransfers, sort, {
        occurredAt: (t) => t.occurredAt,
        amountFrom: (t) => t.amountFrom,
        amountTo: (t) => t.amountTo,
        description: (t) => t.description ?? "",
      }),
    [filteredTransfers, sort],
  );
  const filtersActive = isTransferFilterActive(filters);


  const loadCategories = useCallback(() => fetchCategories(), []);
  const {
    data: categories,
    error: categoriesError,
    loading: categoriesLoading,
    reload: reloadCategories,
  } = useAsyncData(loadCategories);

  const {
    importMsg,
    setImportMsg,
    importBusy,
    pendingImport,
    handleImportCsvFile,
    handleImportContinue,
    handleImportConfirm,
  } = useTransferImport({
    setActionError,
    onSuccess: () => {
      reloadTransfers();
      refreshAccounts();
    },
  });

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

  async function handleLoadMore() {
    if (!nextCursor || loadMoreBusy) return;
    setLoadMoreBusy(true);
    setActionError(null);
    try {
      const page = await fetchTransfers({
        limit: 100,
        cursor: nextCursor,
      });
      setTransfers((prev) => [...prev, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Load more failed");
    } finally {
      setLoadMoreBusy(false);
    }
  }

  async function handleCreate(input: CreateTransferInput) {
    const created = await createTransfer(input);
    if (created.occurredAt) {
      setListMode("month");
      setMonth(utcMonthFromIso(created.occurredAt));
    }
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

  const loading = transfersLoading || accountsLoading || categoriesLoading;
  const error = transfersError ?? accountsError ?? categoriesError;

  return (
    <>
      <PageHeader
        title="Transfers"
        subtitle="Move cash between your accounts. Ledger legs stay read-only. Double-click a cell to edit."
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
          <MonthPager
            mode={listMode}
            month={month}
            onModeChange={setListMode}
            onMonthChange={setMonth}
            hasMore={nextCursor != null}
            loadMoreBusy={loadMoreBusy}
            onLoadMore={() => void handleLoadMore()}
          />
          <TransferFilterBar
            filters={filters}
            onChange={setFilters}
            accounts={sortedAccounts}
            categories={transferCategories}
          />
          {filtersActive &&
            transfers.length > 0 &&
            filteredTransfers.length === 0 && (
              <p className="empty-state" role="status">
                No rows match filters.{" "}
                <button
                  type="button"
                  className="link-button"
                  onClick={() => setFilters({ ...EMPTY_TRANSFER_FILTERS })}
                >
                  Clear
                </button>
              </p>
            )}
          <div className="table-wrap">
            <table className="data-table ledger-table ledger-table--transfers">
              <thead>
                <tr>
                  <SortableTh
                    label="Date"
                    sortKey="occurredAt"
                    sort={sort}
                    onToggle={(key) => setSort((prev) => toggleSort(prev, key))}
                    className="col-date"
                  />
                  <th className="col-text">From</th>
                  <th className="col-text">To</th>
                  <SortableTh
                    label="Amount from"
                    sortKey="amountFrom"
                    sort={sort}
                    onToggle={(key) => setSort((prev) => toggleSort(prev, key))}
                    className="num"
                  />
                  <SortableTh
                    label="Amount to"
                    sortKey="amountTo"
                    sort={sort}
                    onToggle={(key) => setSort((prev) => toggleSort(prev, key))}
                    className="num"
                  />
                  <th className="num">FX rate</th>
                  <th className="col-text">Category</th>
                  <SortableTh
                    label="Description"
                    sortKey="description"
                    sort={sort}
                    onToggle={(key) => setSort((prev) => toggleSort(prev, key))}
                    className="col-text"
                  />
                  <th className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                <TransferCreateRow
                  accounts={sortedAccounts}
                  transferCategories={transferCategories}
                  seedFromAccountId={seedFromAccountId}
                  onSeedConsumed={clearSeedFromAccountId}
                  onCreate={handleCreate}
                  onCategoryCreated={() => {
                    void reloadCategories();
                  }}
                  onActionError={setActionError}
                />
                {sortedTransfers.map((transfer) => {
                const cross = transfer.fromCurrency !== transfer.toCurrency;
                const fromAccount = accountById.get(transfer.fromAccountId);
                const toAccount = accountById.get(transfer.toAccountId);
                return (
                  <tr key={transfer.id}>
                    <td
                      className={cellClass(transfer.id, "occurredAt", true, "col-date")}
                      title="Double-click to edit"
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
                      title="Double-click to edit"
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
                      title={cross ? "Double-click to edit" : undefined}
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
                      title="Double-click to edit"
                      onDoubleClick={() => startEdit(transfer, "categoryId")}
                    >
                      {isEditing(transfer.id, "categoryId") ? (
                        <CategorySelectWithCreate
                          value={draft}
                          options={transferCategories}
                          ledgerType="TRANSFER"
                          disabled={editBusy}
                          autoFocus
                          onChange={setDraft}
                          onCategoryCreated={() => {
                            void reloadCategories();
                          }}
                          onError={setActionError}
                          onKeyDown={(e) => onEditorKeyDown(e, transfer)}
                          onBlur={onEditorBlur}
                          aria-label="Edit category"
                        />
                      ) : (
                        categoryNameById(transferCategories, transfer.categoryId)
                      )}
                    </td>
                    <td
                      className={cellClass(transfer.id, "description", true, "col-text")}
                      title="Double-click to edit"
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
                          aria-label={`Delete transfer ${transfer.id}`}
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
