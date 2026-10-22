import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Category } from "../../api/categoriesApi";
import type { Tag } from "../../api/tagsApi";
import {
  CASH_TX_TYPES,
  type CashTxType,
  type CreateCashTransactionInput,
} from "../../api/transactionsApi";
import { CategorySelectWithCreate } from "./CategorySelectWithCreate";
import { categoryIdsForLedgerType } from "./categoryScope";
import { LedgerTagField } from "./LedgerTagField";
import { dateInputToIso, defaultOccurredAtValue } from "./occurredAt";

export function normalizeCashTxType(value: unknown): CashTxType {
  const raw = String(value ?? "").trim().toUpperCase();
  return (CASH_TX_TYPES as readonly string[]).includes(raw)
    ? (raw as CashTxType)
    : "INCOME";
}

export function LedgerCreateRow(props: {
  seedType: CashTxType;
  categories: Category[];
  tags: Tag[];
  onCreate: (input: CreateCashTransactionInput) => Promise<void>;
  onCategoryCreated: (category: Category) => void;
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
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [createBusy, setCreateBusy] = useState(false);
  const [focusNonce, setFocusNonce] = useState(0);
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (lastEnteredType != null) return;
    setType(normalizeCashTxType(props.seedType));
  }, [props.seedType, lastEnteredType]);

  useEffect(() => {
    if (focusNonce === 0) return;
    // Defer past disabled→enabled commit and parent soft-reload re-render.
    const id = window.setTimeout(() => {
      firstInputRef.current?.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(id);
  }, [focusNonce]);

  const categoryOptions = useMemo(() => {
    const allowed = categoryIdsForLedgerType(props.categories, type);
    return props.categories
      .filter((cat) => allowed.has(cat.id))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [props.categories, type]);

  function onTypeChange(next: CashTxType) {
    setType(next);
    if (categoryId !== "") {
      const allowed = categoryIdsForLedgerType(props.categories, next);
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
    let occurredAtIso: string;
    try {
      occurredAtIso = dateInputToIso(occurredAt);
    } catch {
      props.onActionError("Invalid date");
      return;
    }
    setCreateBusy(true);
    try {
      await props.onCreate({
        type,
        amount: amountNumber,
        occurredAt: occurredAtIso,
        description: description.trim() ? description.trim() : null,
        categoryId: categoryId === "" ? null : Number(categoryId),
        tagIds,
      });
      setLastEnteredType(type);
      setAmount("");
      setDescription("");
      setCategoryId("");
      setTagIds([]);
      // Focus after React re-enables controls (was focusing while still disabled).
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
          ref={firstInputRef}
          type="date"
          className="ledger-cell-input"
          value={occurredAt}
          onChange={(e) => setOccurredAt(e.target.value)}
          onKeyDown={onFieldKeyDown}
          aria-label="New date"
        />
      </td>
      <td className="col-status">
        <select
          className="ledger-cell-input"
          value={type}
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
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={onFieldKeyDown}
          aria-label="New amount"
          placeholder="0.00"
        />
      </td>
      <td className="col-text">
        <CategorySelectWithCreate
          value={categoryId}
          options={categoryOptions}
          ledgerType={type}
          onChange={setCategoryId}
          onCategoryCreated={props.onCategoryCreated}
          onError={props.onActionError}
          onKeyDown={onFieldKeyDown}
          aria-label="New category"
        />
      </td>
      <td className="col-text">
        <LedgerTagField
          tags={props.tags}
          selectedIds={tagIds}
          onChange={setTagIds}
          onKeyDown={onFieldKeyDown}
          aria-label="New tags"
        />
      </td>
      <td className="col-text">
        <input
          type="text"
          className="ledger-cell-input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={onFieldKeyDown}
          aria-label="New description"
          placeholder="Description"
        />
      </td>
      <td className="col-actions">
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
