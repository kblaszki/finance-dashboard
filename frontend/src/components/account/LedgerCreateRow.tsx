import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Category } from "../../api/categoriesApi";
import {
  CASH_TX_TYPES,
  type CashTxType,
  type CreateCashTransactionInput,
} from "../../api/transactionsApi";
import {
  categoryIdsUnderRoot,
  rootNameForTxType,
} from "./categoryScope";
import { defaultOccurredAtValue } from "./occurredAt";

export function normalizeCashTxType(value: unknown): CashTxType {
  const raw = String(value ?? "").trim().toUpperCase();
  return (CASH_TX_TYPES as readonly string[]).includes(raw)
    ? (raw as CashTxType)
    : "INCOME";
}

export function LedgerCreateRow(props: {
  seedType: CashTxType;
  categories: Category[];
  onCreate: (input: CreateCashTransactionInput) => Promise<void>;
  onActionError: (message: string | null) => void;
}) {
  const [lastEnteredType, setLastEnteredType] = useState<CashTxType | null>(
    null,
  );
  const [type, setType] = useState<CashTxType>(() =>
    normalizeCashTxType(props.seedType),
  );
  const [amount, setAmount] = useState("");
  const [occurredAt, setOccurredAt] = useState(defaultOccurredAtValue);
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (lastEnteredType != null) return;
    setType(normalizeCashTxType(props.seedType));
  }, [props.seedType, lastEnteredType]);

  const categoryOptions = useMemo(() => {
    const allowed = categoryIdsUnderRoot(
      props.categories,
      rootNameForTxType(type),
    );
    return props.categories
      .filter((cat) => allowed.has(cat.id))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [props.categories, type]);

  function onTypeChange(next: CashTxType) {
    setType(next);
    if (categoryId !== "") {
      const allowed = categoryIdsUnderRoot(
        props.categories,
        rootNameForTxType(next),
      );
      if (!allowed.has(Number(categoryId))) {
        setCategoryId("");
      }
    }
  }

  async function submit() {
    props.onActionError(null);
    const amountNumber = Number(amount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      props.onActionError("Amount must be a positive number");
      return;
    }
    const date = new Date(occurredAt);
    if (Number.isNaN(date.getTime())) {
      props.onActionError("Invalid date");
      return;
    }
    setCreateBusy(true);
    try {
      await props.onCreate({
        type,
        amount: amountNumber,
        occurredAt: date.toISOString(),
        description: description.trim() ? description.trim() : null,
        categoryId: categoryId === "" ? null : Number(categoryId),
      });
      setLastEnteredType(type);
      setAmount("");
      setDescription("");
      setCategoryId("");
      firstInputRef.current?.focus();
    } catch (err) {
      props.onActionError(err instanceof Error ? err.message : "Create failed");
    } finally {
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
          ref={firstInputRef}
          type="datetime-local"
          className="ledger-cell-input"
          value={occurredAt}
          disabled={createBusy}
          onChange={(e) => setOccurredAt(e.target.value)}
          onKeyDown={onFieldKeyDown}
          aria-label="New date"
        />
      </td>
      <td>
        <select
          className="ledger-cell-input"
          value={type}
          disabled={createBusy}
          onChange={(e) => onTypeChange(e.target.value as CashTxType)}
          onKeyDown={onFieldKeyDown}
          aria-label="New type"
        >
          {CASH_TX_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
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
          required
          className="ledger-cell-input"
          value={amount}
          disabled={createBusy}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={onFieldKeyDown}
          aria-label="New amount"
          placeholder="0.00"
        />
      </td>
      <td>
        <select
          className="ledger-cell-input"
          value={categoryId}
          disabled={createBusy}
          onChange={(e) => setCategoryId(e.target.value)}
          onKeyDown={onFieldKeyDown}
          aria-label="New category"
        >
          <option value="">—</option>
          {categoryOptions.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </td>
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
        <form className="form-actions-row" onSubmit={onFormSubmit}>
          <button
            type="submit"
            className="btn-primary"
            disabled={createBusy}
            aria-label="Add transaction"
          >
            {createBusy ? "…" : "Add"}
          </button>
        </form>
      </td>
    </tr>
  );
}
