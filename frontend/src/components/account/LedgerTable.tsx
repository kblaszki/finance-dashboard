import { type FormEvent, useState } from "react";
import type { CashTransaction } from "../../api/transactionsApi";
import { formatMoney } from "../../utils/format";
import { formatOccurredAt } from "./occurredAt";

export function LedgerTable(props: {
  transactions: CashTransaction[];
  currency: string | null;
  categoryNameById: Map<number, string>;
  onDelete: (tx: CashTransaction) => void;
  onSave: (
    tx: CashTransaction,
    input: { amount: number; description: string | null },
  ) => Promise<void>;
  onActionError: (message: string | null) => void;
}) {
  const [editingTxId, setEditingTxId] = useState<number | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  async function handleSaveTxEdit(e: FormEvent, tx: CashTransaction) {
    e.preventDefault();
    props.onActionError(null);
    setEditBusy(true);
    try {
      await props.onSave(tx, {
        amount: Number(editAmount),
        description: editDescription.trim() ? editDescription.trim() : null,
      });
      setEditingTxId(null);
    } catch (err) {
      props.onActionError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setEditBusy(false);
    }
  }

  return (
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
          {props.transactions.map((tx) => (
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
                {props.currency
                  ? formatMoney(tx.amount, props.currency)
                  : tx.amount}
              </td>
              <td>
                {tx.categoryId != null ? (
                  <span className="badge">
                    {props.categoryNameById.get(tx.categoryId) ??
                      `#${tx.categoryId}`}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td>{tx.description ?? "—"}</td>
              <td>
                {editingTxId === tx.id ? (
                  <form
                    className="auth-form auth-form--compact"
                    onSubmit={(e) => void handleSaveTxEdit(e, tx)}
                  >
                    <label>
                      Amount
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        inputMode="decimal"
                        required
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
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
                    <div className="form-actions-row">
                      <button type="submit" className="btn-primary" disabled={editBusy}>
                        Save
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setEditingTxId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="form-actions-row">
                    <button
                      type="button"
                      className="btn-secondary"
                      aria-label={`Edit ${tx.type} ${tx.amount}`}
                      onClick={() => {
                        setEditingTxId(tx.id);
                        setEditAmount(String(tx.amount));
                        setEditDescription(tx.description ?? "");
                        props.onActionError(null);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-danger"
                      aria-label={`Delete ${tx.type} ${tx.amount}`}
                      onClick={() => props.onDelete(tx)}
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
  );
}
