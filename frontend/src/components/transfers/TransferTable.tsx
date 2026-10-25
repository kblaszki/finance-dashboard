import {
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { type Account } from "../../api/accountsApi";
import { type Category } from "../../api/categoriesApi";
import {
  deleteTransfer,
  updateTransfer,
  type CashTransfer,
  type CreateTransferInput,
  type UpdateTransferInput,
} from "../../api/transfersApi";
import { CategorySelectWithCreate } from "../account/CategorySelectWithCreate";
import {
  dateInputToIso,
  formatOccurredAt,
  toDateLocalValue,
} from "../account/occurredAt";
import { SortableTh } from "../ui/SortableTh";
import { formatMoney } from "../../utils/format";
import {
  toggleSort,
  type SortState,
} from "../../utils/tableSort";
import { accountLabel, TransferCreateRow } from "./TransferCreateRow";

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

export function buildTransferPatch(
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

export function TransferTable(props: {
  transfers: CashTransfer[];
  accounts: Account[];
  accountById: Map<number, Account>;
  transferCategories: Category[];
  sort: SortState<TransferSortKey> | null;
  onSortChange: (next: SortState<TransferSortKey> | null) => void;
  seedFromAccountId: number | null;
  onSeedConsumed: () => void;
  onCreate: (input: CreateTransferInput) => Promise<void>;
  onCategoryCreated: () => void;
  onActionError: (message: string | null) => void;
  onMutated: () => void;
}) {
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [draft, setDraft] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const committingRef = useRef(false);
  const blurTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current != null) {
        window.clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

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
    props.onActionError(null);
  }

  function cancelEdit() {
    setEditing(null);
    setDraft("");
  }

  function onEditorBlur() {
    if (blurTimeoutRef.current != null) {
      window.clearTimeout(blurTimeoutRef.current);
    }
    blurTimeoutRef.current = window.setTimeout(() => {
      blurTimeoutRef.current = null;
      if (!committingRef.current) cancelEdit();
    }, 0);
  }

  async function commitEdit(transfer: CashTransfer) {
    if (!editing || editing.transferId !== transfer.id || editBusy) return;
    props.onActionError(null);
    committingRef.current = true;
    setEditBusy(true);
    try {
      const patch = buildTransferPatch(editing.field, draft);
      await updateTransfer(transfer.id, patch);
      cancelEdit();
      props.onMutated();
    } catch (err) {
      props.onActionError(err instanceof Error ? err.message : "Update failed");
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

  async function handleDelete(transfer: CashTransfer) {
    const fromName =
      props.accountById.get(transfer.fromAccountId)?.name ??
      `#${transfer.fromAccountId}`;
    const toName =
      props.accountById.get(transfer.toAccountId)?.name ??
      `#${transfer.toAccountId}`;
    const ok = window.confirm(
      `Delete transfer ${formatMoney(transfer.amountFrom, transfer.fromCurrency)} from ${fromName} to ${toName}?`,
    );
    if (!ok) return;
    props.onActionError(null);
    try {
      await deleteTransfer(transfer.id);
      props.onMutated();
    } catch (err) {
      props.onActionError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div className="table-wrap">
      <table className="data-table ledger-table ledger-table--transfers">
        <thead>
          <tr>
            <SortableTh
              label="Date"
              sortKey="occurredAt"
              sort={props.sort}
              onToggle={(key) =>
                props.onSortChange(toggleSort(props.sort, key))
              }
              className="col-date"
            />
            <th className="col-text">From</th>
            <th className="col-text">To</th>
            <SortableTh
              label="Amount from"
              sortKey="amountFrom"
              sort={props.sort}
              onToggle={(key) =>
                props.onSortChange(toggleSort(props.sort, key))
              }
              className="num"
            />
            <SortableTh
              label="Amount to"
              sortKey="amountTo"
              sort={props.sort}
              onToggle={(key) =>
                props.onSortChange(toggleSort(props.sort, key))
              }
              className="num"
            />
            <th className="num">FX rate</th>
            <th className="col-text">Category</th>
            <SortableTh
              label="Description"
              sortKey="description"
              sort={props.sort}
              onToggle={(key) =>
                props.onSortChange(toggleSort(props.sort, key))
              }
              className="col-text"
            />
            <th className="col-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          <TransferCreateRow
            accounts={props.accounts}
            transferCategories={props.transferCategories}
            seedFromAccountId={props.seedFromAccountId}
            onSeedConsumed={props.onSeedConsumed}
            onCreate={props.onCreate}
            onCategoryCreated={props.onCategoryCreated}
            onActionError={props.onActionError}
          />
          {props.transfers.map((transfer) => {
            const cross = transfer.fromCurrency !== transfer.toCurrency;
            const fromAccount = props.accountById.get(transfer.fromAccountId);
            const toAccount = props.accountById.get(transfer.toAccountId);
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
                  className={cellClass(
                    transfer.id,
                    "fromAccountId",
                    true,
                    "col-text",
                  )}
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
                      {props.accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {accountLabel(account)}
                        </option>
                      ))}
                    </select>
                  ) : fromAccount ? (
                    accountLabel(fromAccount)
                  ) : (
                    `#${transfer.fromAccountId}`
                  )}
                </td>
                <td
                  className={cellClass(
                    transfer.id,
                    "toAccountId",
                    true,
                    "col-text",
                  )}
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
                      {props.accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {accountLabel(account)}
                        </option>
                      ))}
                    </select>
                  ) : toAccount ? (
                    accountLabel(toAccount)
                  ) : (
                    `#${transfer.toAccountId}`
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
                  className={cellClass(transfer.id, "amountTo", cross, "num")}
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
                      options={props.transferCategories}
                      ledgerType="TRANSFER"
                      disabled={editBusy}
                      autoFocus
                      onChange={setDraft}
                      onCategoryCreated={props.onCategoryCreated}
                      onError={props.onActionError}
                      onKeyDown={(e) => onEditorKeyDown(e, transfer)}
                      onBlur={onEditorBlur}
                      aria-label="Edit category"
                    />
                  ) : (
                    categoryNameById(
                      props.transferCategories,
                      transfer.categoryId,
                    )
                  )}
                </td>
                <td
                  className={cellClass(
                    transfer.id,
                    "description",
                    true,
                    "col-text",
                  )}
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
  );
}
