import { type KeyboardEvent, useMemo, useRef, useState } from "react";
import type { Category } from "../../api/categoriesApi";
import {
  CASH_TX_TYPES,
  type CashTransaction,
  type CashTxType,
  type CreateCashTransactionInput,
} from "../../api/transactionsApi";
import { formatMoney } from "../../utils/format";
import { categoryIdsForLedgerType } from "./categoryScope";
import {
  LedgerCreateRow,
  normalizeCashTxType,
} from "./LedgerCreateRow";
import { formatOccurredAt, toDateTimeLocalValue } from "./occurredAt";

export type EditableField =
  | "occurredAt"
  | "type"
  | "amount"
  | "categoryId"
  | "description";

type EditingState = { txId: number; field: EditableField };

function draftFromTx(tx: CashTransaction, field: EditableField): string {
  switch (field) {
    case "amount":
      return String(tx.amount);
    case "description":
      return tx.description ?? "";
    case "occurredAt":
      return toDateTimeLocalValue(tx.occurredAt);
    case "type":
      return String(tx.type).toUpperCase();
    case "categoryId":
      return tx.categoryId == null ? "" : String(tx.categoryId);
  }
}

function buildPatch(
  tx: CashTransaction,
  field: EditableField,
  draft: string,
  categories: Category[],
): Partial<CreateCashTransactionInput> {
  switch (field) {
    case "amount": {
      const amount = Number(draft);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Amount must be a positive number");
      }
      return { amount };
    }
    case "description": {
      const trimmed = draft.trim();
      return { description: trimmed ? trimmed : null };
    }
    case "occurredAt": {
      const date = new Date(draft);
      if (Number.isNaN(date.getTime())) {
        throw new Error("Invalid date");
      }
      return { occurredAt: date.toISOString() };
    }
    case "type": {
      const type = draft.trim().toUpperCase() as CashTxType;
      if (!(CASH_TX_TYPES as readonly string[]).includes(type)) {
        throw new Error("Type must be INCOME or EXPENSE");
      }
      const patch: Partial<CreateCashTransactionInput> = { type };
      if (tx.categoryId != null) {
        const allowed = categoryIdsForLedgerType(categories, type);
        if (!allowed.has(tx.categoryId)) {
          patch.categoryId = null;
        }
      }
      return patch;
    }
    case "categoryId": {
      if (draft === "") return { categoryId: null };
      const id = Number(draft);
      if (!Number.isInteger(id) || id < 1) {
        throw new Error("Invalid category");
      }
      const rawType = String(tx.type).toUpperCase() as CashTxType;
      const txType = (CASH_TX_TYPES as readonly string[]).includes(rawType)
        ? rawType
        : "EXPENSE";
      const allowed = categoryIdsForLedgerType(categories, txType);
      if (!allowed.has(id)) {
        throw new Error("Category does not match transaction type");
      }
      return { categoryId: id };
    }
  }
}

export function LedgerTable(props: {
  accountId: number;
  transactions: CashTransaction[];
  currency: string | null;
  categories: Category[];
  categoryNameById: Map<number, string>;
  onCreate: (input: CreateCashTransactionInput) => Promise<void>;
  onDelete: (tx: CashTransaction) => void;
  onSave: (
    tx: CashTransaction,
    patch: Partial<CreateCashTransactionInput>,
  ) => Promise<void>;
  onActionError: (message: string | null) => void;
}) {
  const seedType = normalizeCashTxType(props.transactions[0]?.type);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [draft, setDraft] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const committingRef = useRef(false);

  function startEdit(tx: CashTransaction, field: EditableField) {
    if (editBusy) return;
    setEditing({ txId: tx.id, field });
    setDraft(draftFromTx(tx, field));
    props.onActionError(null);
  }

  function cancelEdit() {
    setEditing(null);
    setDraft("");
  }

  /** Blur cancels; defer so Enter commit can set committingRef first. */
  function onEditorBlur() {
    window.setTimeout(() => {
      if (!committingRef.current) cancelEdit();
    }, 0);
  }

  async function commitEdit(tx: CashTransaction) {
    if (!editing || editing.txId !== tx.id || editBusy) return;
    props.onActionError(null);
    committingRef.current = true;
    setEditBusy(true);
    try {
      const patch = buildPatch(tx, editing.field, draft, props.categories);
      await props.onSave(tx, patch);
      cancelEdit();
    } catch (err) {
      props.onActionError(err instanceof Error ? err.message : "Update failed");
    } finally {
      committingRef.current = false;
      setEditBusy(false);
    }
  }

  function onEditorKeyDown(e: KeyboardEvent, tx: CashTransaction) {
    if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      void commitEdit(tx);
    }
  }

  function isEditing(txId: number, field: EditableField): boolean {
    return editing?.txId === txId && editing.field === field;
  }

  function cellClass(txId: number, field: EditableField, extra = ""): string {
    const parts = ["ledger-cell", "ledger-cell--editable"];
    if (isEditing(txId, field)) parts.push("ledger-cell--editing");
    if (extra) parts.push(extra);
    return parts.join(" ");
  }

  return (
    <div className="table-wrap">
      <table className="data-table ledger-table">
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
          <LedgerCreateRow
            key={props.accountId}
            seedType={seedType}
            categories={props.categories}
            onCreate={props.onCreate}
            onActionError={props.onActionError}
          />
          {props.transactions.map((tx) => (
            <LedgerRow
              key={tx.id}
              tx={tx}
              currency={props.currency}
              categories={props.categories}
              categoryNameById={props.categoryNameById}
              draft={draft}
              editBusy={editBusy}
              isEditing={isEditing}
              cellClass={cellClass}
              onStartEdit={startEdit}
              onDraftChange={setDraft}
              onEditorKeyDown={onEditorKeyDown}
              onEditorBlur={onEditorBlur}
              onDelete={props.onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LedgerRow(props: {
  tx: CashTransaction;
  currency: string | null;
  categories: Category[];
  categoryNameById: Map<number, string>;
  draft: string;
  editBusy: boolean;
  isEditing: (txId: number, field: EditableField) => boolean;
  cellClass: (txId: number, field: EditableField, extra?: string) => string;
  onStartEdit: (tx: CashTransaction, field: EditableField) => void;
  onDraftChange: (value: string) => void;
  onEditorKeyDown: (e: KeyboardEvent, tx: CashTransaction) => void;
  onEditorBlur: () => void;
  onDelete: (tx: CashTransaction) => void;
}) {
  const { tx } = props;
  const txType = String(tx.type).toUpperCase() as CashTxType;
  const categoryOptions = useMemo(() => {
    const typeOk = (CASH_TX_TYPES as readonly string[]).includes(txType)
      ? txType
      : "EXPENSE";
    const allowed = categoryIdsForLedgerType(props.categories, typeOk);
    return props.categories
      .filter((cat) => allowed.has(cat.id))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [props.categories, txType]);

  return (
    <tr>
      <td
        className={props.cellClass(tx.id, "occurredAt")}
        onDoubleClick={() => props.onStartEdit(tx, "occurredAt")}
      >
        {props.isEditing(tx.id, "occurredAt") ? (
          <input
            type="datetime-local"
            className="ledger-cell-input"
            value={props.draft}
            disabled={props.editBusy}
            autoFocus
            onChange={(e) => props.onDraftChange(e.target.value)}
            onKeyDown={(e) => props.onEditorKeyDown(e, tx)}
            onBlur={props.onEditorBlur}
            aria-label="Edit date"
          />
        ) : (
          formatOccurredAt(tx.occurredAt)
        )}
      </td>
      <td
        className={props.cellClass(tx.id, "type")}
        onDoubleClick={() => props.onStartEdit(tx, "type")}
      >
        {props.isEditing(tx.id, "type") ? (
          <select
            className="ledger-cell-input"
            value={props.draft}
            disabled={props.editBusy}
            autoFocus
            onChange={(e) => props.onDraftChange(e.target.value)}
            onKeyDown={(e) => props.onEditorKeyDown(e, tx)}
            onBlur={props.onEditorBlur}
            aria-label="Edit type"
          >
            {CASH_TX_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        ) : (
          <span
            className={`badge ${tx.type === "INCOME" ? "badge-positive" : "badge-negative"}`}
          >
            {tx.type}
          </span>
        )}
      </td>
      <td
        className={props.cellClass(tx.id, "amount", "num")}
        onDoubleClick={() => props.onStartEdit(tx, "amount")}
      >
        {props.isEditing(tx.id, "amount") ? (
          <input
            type="number"
            step="0.01"
            min="0.01"
            inputMode="decimal"
            className="ledger-cell-input"
            value={props.draft}
            disabled={props.editBusy}
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => props.onDraftChange(e.target.value)}
            onKeyDown={(e) => props.onEditorKeyDown(e, tx)}
            onBlur={props.onEditorBlur}
            aria-label="Edit amount"
          />
        ) : props.currency ? (
          formatMoney(tx.amount, props.currency)
        ) : (
          tx.amount
        )}
      </td>
      <td
        className={props.cellClass(tx.id, "categoryId")}
        onDoubleClick={() => props.onStartEdit(tx, "categoryId")}
      >
        {props.isEditing(tx.id, "categoryId") ? (
          <select
            className="ledger-cell-input"
            value={props.draft}
            disabled={props.editBusy}
            autoFocus
            onChange={(e) => props.onDraftChange(e.target.value)}
            onKeyDown={(e) => props.onEditorKeyDown(e, tx)}
            onBlur={props.onEditorBlur}
            aria-label="Edit category"
          >
            <option value="">—</option>
            {categoryOptions.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        ) : tx.categoryId != null ? (
          <span className="badge">
            {props.categoryNameById.get(tx.categoryId) ?? `#${tx.categoryId}`}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td
        className={props.cellClass(tx.id, "description")}
        onDoubleClick={() => props.onStartEdit(tx, "description")}
      >
        {props.isEditing(tx.id, "description") ? (
          <input
            type="text"
            className="ledger-cell-input"
            value={props.draft}
            disabled={props.editBusy}
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => props.onDraftChange(e.target.value)}
            onKeyDown={(e) => props.onEditorKeyDown(e, tx)}
            onBlur={props.onEditorBlur}
            aria-label="Edit description"
          />
        ) : (
          (tx.description ?? "—")
        )}
      </td>
      <td>
        <div className="form-actions-row">
          <button
            type="button"
            className="btn-danger"
            aria-label={`Delete ${tx.type} ${tx.amount}`}
            onClick={() => props.onDelete(tx)}
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}
