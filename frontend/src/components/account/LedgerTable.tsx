import { type KeyboardEvent, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Category } from "../../api/categoriesApi";
import type { Tag } from "../../api/tagsApi";
import {
  CASH_TX_TYPES,
  type CashTransaction,
  type CashTxType,
  type CreateCashTransactionInput,
} from "../../api/transactionsApi";
import { SortableTh } from "../ui/SortableTh";
import { formatMoney } from "../../utils/format";
import {
  sortBy,
  toggleSort,
  type SortState,
} from "../../utils/tableSort";
import { CategorySelectWithCreate } from "./CategorySelectWithCreate";
import { categoryIdsForLedgerType } from "./categoryScope";
import {
  LedgerCreateRow,
  normalizeCashTxType,
} from "./LedgerCreateRow";
import { LedgerTagField } from "./LedgerTagField";
import { dateInputToIso, formatOccurredAt, toDateLocalValue } from "./occurredAt";

type LedgerSortKey = "occurredAt" | "amount" | "description";

function isTransferLeg(tx: CashTransaction): boolean {
  return tx.transferId != null;
}

function transferBadgeLabel(type: string): string {
  const upper = String(type).toUpperCase();
  if (upper === "TRANSFER_IN") return "TRANSFER IN";
  if (upper === "TRANSFER_OUT") return "TRANSFER OUT";
  return upper;
}

function encodeTagIds(ids: number[]): string {
  return [...ids].sort((a, b) => a - b).join(",");
}

function parseTagIdsDraft(draft: string): number[] {
  if (!draft.trim()) return [];
  const ids = draft.split(",").map((part) => Number(part));
  if (ids.some((id) => !Number.isInteger(id) || id < 1)) {
    throw new Error("Invalid tags");
  }
  return [...new Set(ids)].sort((a, b) => a - b);
}

export type EditableField =
  | "occurredAt"
  | "type"
  | "amount"
  | "categoryId"
  | "tagIds"
  | "description";

type EditingState = { txId: number; field: EditableField };

function draftFromTx(tx: CashTransaction, field: EditableField): string {
  switch (field) {
    case "amount":
      return String(tx.amount);
    case "description":
      return tx.description ?? "";
    case "occurredAt":
      return toDateLocalValue(tx.occurredAt);
    case "type":
      return String(tx.type).toUpperCase();
    case "categoryId":
      return tx.categoryId == null ? "" : String(tx.categoryId);
    case "tagIds":
      return encodeTagIds(tx.tagIds ?? []);
  }
}

function buildPatch(
  tx: CashTransaction,
  field: EditableField,
  draft: string,
  categories: Category[],
  tags: Tag[],
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
      return { occurredAt: dateInputToIso(draft) };
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
    case "tagIds": {
      const tagIds = parseTagIdsDraft(draft);
      const owned = new Set(tags.map((t) => t.id));
      if (tagIds.some((id) => !owned.has(id))) {
        throw new Error("Invalid tags");
      }
      return { tagIds };
    }
  }
}

export function LedgerTable(props: {
  accountId: number;
  transactions: CashTransaction[];
  currency: string | null;
  categories: Category[];
  categoryNameById: Map<number, string>;
  tags: Tag[];
  tagNameById: Map<number, string>;
  onCreate: (input: CreateCashTransactionInput) => Promise<void>;
  onCategoryCreated: (category: Category) => void;
  onDelete: (tx: CashTransaction) => void;
  onSave: (
    tx: CashTransaction,
    patch: Partial<CreateCashTransactionInput>,
  ) => Promise<void>;
  onActionError: (message: string | null) => void;
}) {
  const seedType = normalizeCashTxType(props.transactions[0]?.type);
  const [sort, setSort] = useState<SortState<LedgerSortKey> | null>(null);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [draft, setDraft] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const committingRef = useRef(false);

  const sortedTransactions = useMemo(
    () =>
      sortBy(props.transactions, sort, {
        occurredAt: (tx) => tx.occurredAt,
        amount: (tx) => tx.amount,
        description: (tx) => tx.description ?? "",
      }),
    [props.transactions, sort],
  );

  function startEdit(tx: CashTransaction, field: EditableField) {
    if (editBusy || isTransferLeg(tx)) return;
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
      const patch = buildPatch(
        tx,
        editing.field,
        draft,
        props.categories,
        props.tags,
      );
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

  function cellClass(
    txId: number,
    field: EditableField,
    extra = "",
    editable = true,
  ): string {
    const parts = ["ledger-cell"];
    if (editable) parts.push("ledger-cell--editable");
    if (isEditing(txId, field)) parts.push("ledger-cell--editing");
    if (extra) parts.push(extra);
    return parts.join(" ");
  }

  return (
    <div className="table-wrap">
      <table className="data-table ledger-table ledger-table--account">
        <thead>
          <tr>
            <SortableTh
              label="Date"
              sortKey="occurredAt"
              sort={sort}
              onToggle={(key) => setSort((prev) => toggleSort(prev, key))}
              className="col-date"
            />
            <th className="col-status">Type</th>
            <SortableTh
              label="Amount"
              sortKey="amount"
              sort={sort}
              onToggle={(key) => setSort((prev) => toggleSort(prev, key))}
              className="num"
            />
            <th className="col-text">Category</th>
            <th className="col-text">Tags</th>
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
          <LedgerCreateRow
            key={props.accountId}
            seedType={seedType}
            categories={props.categories}
            tags={props.tags}
            onCreate={props.onCreate}
            onCategoryCreated={props.onCategoryCreated}
            onActionError={props.onActionError}
          />
          {sortedTransactions.map((tx) => (
            <LedgerRow
              key={tx.id}
              tx={tx}
              currency={props.currency}
              categories={props.categories}
              categoryNameById={props.categoryNameById}
              tags={props.tags}
              tagNameById={props.tagNameById}
              draft={draft}
              editBusy={editBusy}
              isEditing={isEditing}
              cellClass={cellClass}
              onStartEdit={startEdit}
              onDraftChange={setDraft}
              onEditorKeyDown={onEditorKeyDown}
              onEditorBlur={onEditorBlur}
              onCategoryCreated={props.onCategoryCreated}
              onActionError={props.onActionError}
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
  tags: Tag[];
  tagNameById: Map<number, string>;
  draft: string;
  editBusy: boolean;
  isEditing: (txId: number, field: EditableField) => boolean;
  cellClass: (
    txId: number,
    field: EditableField,
    extra?: string,
    editable?: boolean,
  ) => string;
  onStartEdit: (tx: CashTransaction, field: EditableField) => void;
  onDraftChange: (value: string) => void;
  onEditorKeyDown: (e: KeyboardEvent, tx: CashTransaction) => void;
  onEditorBlur: () => void;
  onCategoryCreated: (category: Category) => void;
  onActionError: (message: string | null) => void;
  onDelete: (tx: CashTransaction) => void;
}) {
  const { tx } = props;
  const transferLeg = isTransferLeg(tx);
  const txType = String(tx.type).toUpperCase() as CashTxType;
  const categoryLedgerType =
    (CASH_TX_TYPES as readonly string[]).includes(txType) ? txType : "EXPENSE";
  const categoryOptions = useMemo(() => {
    const allowed = categoryIdsForLedgerType(
      props.categories,
      categoryLedgerType,
    );
    return props.categories
      .filter((cat) => allowed.has(cat.id))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [props.categories, categoryLedgerType]);

  const tagIds = tx.tagIds ?? [];
  const tagLabels = tagIds
    .map((id) => props.tagNameById.get(id) ?? `#${id}`)
    .sort((a, b) => a.localeCompare(b));

  function onCellDoubleClick(field: EditableField) {
    if (transferLeg) return;
    props.onStartEdit(tx, field);
  }

  const editHint = transferLeg ? undefined : "Double-click to edit";

  const typeBadgeClass =
    String(tx.type).toUpperCase() === "INCOME" ||
    String(tx.type).toUpperCase() === "TRANSFER_IN"
      ? "badge-positive"
      : "badge-negative";

  return (
    <tr>
      <td
        className={props.cellClass(tx.id, "occurredAt", "col-date", !transferLeg)}
        title={editHint}
        onDoubleClick={() => onCellDoubleClick("occurredAt")}
      >
        {props.isEditing(tx.id, "occurredAt") ? (
          <input
            type="date"
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
        className={props.cellClass(tx.id, "type", "col-status", !transferLeg)}
        title={editHint}
        onDoubleClick={() => onCellDoubleClick("type")}
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
          <span className={`badge ${typeBadgeClass}`}>
            {transferLeg ? transferBadgeLabel(tx.type) : tx.type}
          </span>
        )}
      </td>
      <td
        className={props.cellClass(tx.id, "amount", "num", !transferLeg)}
        title={editHint}
        onDoubleClick={() => onCellDoubleClick("amount")}
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
        className={props.cellClass(tx.id, "categoryId", "col-text", !transferLeg)}
        title={editHint}
        onDoubleClick={() => onCellDoubleClick("categoryId")}
      >
        {props.isEditing(tx.id, "categoryId") ? (
          <CategorySelectWithCreate
            value={props.draft}
            options={categoryOptions}
            ledgerType={categoryLedgerType}
            disabled={props.editBusy}
            autoFocus
            onChange={props.onDraftChange}
            onCategoryCreated={props.onCategoryCreated}
            onError={props.onActionError}
            onKeyDown={(e) => props.onEditorKeyDown(e, tx)}
            onBlur={props.onEditorBlur}
            aria-label="Edit category"
          />
        ) : tx.categoryId != null ? (
          <span className="badge">
            {props.categoryNameById.get(tx.categoryId) ?? `#${tx.categoryId}`}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td
        className={props.cellClass(tx.id, "tagIds", "col-text", !transferLeg)}
        title={editHint}
        onDoubleClick={() => onCellDoubleClick("tagIds")}
      >
        {props.isEditing(tx.id, "tagIds") ? (
          <LedgerTagField
            tags={props.tags}
            selectedIds={
              props.draft
                ? props.draft
                    .split(",")
                    .filter(Boolean)
                    .map((part) => Number(part))
                : []
            }
            onChange={(ids) => props.onDraftChange(encodeTagIds(ids))}
            disabled={props.editBusy}
            autoFocus
            onKeyDown={(e) => props.onEditorKeyDown(e, tx)}
            onBlur={props.onEditorBlur}
            aria-label="Edit tags"
          />
        ) : tagLabels.length > 0 ? (
          <span className="tag-list">
            {tagLabels.map((label) => (
              <span key={label} className="badge">
                {label}
              </span>
            ))}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td
        className={props.cellClass(tx.id, "description", "col-text", !transferLeg)}
        title={editHint}
        onDoubleClick={() => onCellDoubleClick("description")}
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
      <td className="col-actions">
        <div className="form-actions-row">
          {transferLeg ? (
            <Link to="/transfers" className="btn-secondary">
              Transfer
            </Link>
          ) : (
            <button
              type="button"
              className="btn-danger"
              aria-label={`Delete ${tx.type} ${tx.amount}`}
              onClick={() => props.onDelete(tx)}
            >
              Delete
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
