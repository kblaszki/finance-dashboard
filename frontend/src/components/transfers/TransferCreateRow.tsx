import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Account } from "../../api/accountsApi";
import type { Category } from "../../api/categoriesApi";
import type { CreateTransferInput } from "../../api/transfersApi";
import {
  dateInputToIso,
  defaultOccurredAtValue,
} from "../account/occurredAt";
import { CategorySelectWithCreate } from "../account/CategorySelectWithCreate";

export function accountLabel(account: Account): string {
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

export function TransferCreateRow(props: {
  accounts: Account[];
  transferCategories: Category[];
  seedFromAccountId: number | null;
  onSeedConsumed: () => void;
  onCreate: (input: CreateTransferInput) => Promise<void>;
  onCategoryCreated: (category: Category) => void;
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
  const {
    accounts,
    seedFromAccountId,
    onSeedConsumed,
  } = props;

  useEffect(() => {
    if (seedFromAccountId == null) return;
    if (accounts.length === 0) return;
    const match = accounts.some((a) => a.id === seedFromAccountId);
    if (match) {
      setFromAccountId(String(seedFromAccountId));
      setFocusNonce((n) => n + 1);
    }
    onSeedConsumed();
  }, [seedFromAccountId, accounts, onSeedConsumed]);

  const fromCurrency = currencyForAccount(props.accounts, fromAccountId);
  const toCurrency = currencyForAccount(props.accounts, toAccountId);
  const crossCurrency =
    fromCurrency != null && toCurrency != null && fromCurrency !== toCurrency;

  useEffect(() => {
    if (focusNonce === 0) return;
    let cancelled = false;
    const id = window.setTimeout(() => {
      if (cancelled) return;
      dateRef.current?.focus({ preventScroll: true });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
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
        <CategorySelectWithCreate
          value={categoryId}
          options={props.transferCategories}
          ledgerType="TRANSFER"
          disabled={createBusy}
          onChange={setCategoryId}
          onCategoryCreated={props.onCategoryCreated}
          onError={props.onActionError}
          onKeyDown={onFieldKeyDown}
          aria-label="New category"
        />
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
          <button
            type="submit"
            className="btn-primary"
            disabled={createBusy}
            aria-label="Add transfer"
          >
            Add
          </button>
        </form>
      </td>
    </tr>
  );
}
