import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import type { CategoryLedgerType } from "../../api/categoriesApi";

export type CategoryTreeRow = {
  id: number;
  name: string;
  parentId: number | null;
  ledgerType: CategoryLedgerType;
  createdAt: string;
  depth: number;
};

export function CategoryCreateRow(props: {
  ledgerType: CategoryLedgerType;
  parentOptions: CategoryTreeRow[];
  onCreate: (input: {
    name: string;
    parentId: number | null;
    ledgerType: CategoryLedgerType;
  }) => Promise<void>;
  onActionError: (message: string | null) => void;
}) {
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [focusNonce, setFocusNonce] = useState(0);
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (focusNonce === 0) return;
    let cancelled = false;
    const id = window.setTimeout(() => {
      if (cancelled) return;
      nameRef.current?.focus({ preventScroll: true });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [focusNonce]);

  async function submit() {
    props.onActionError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      props.onActionError("Name required");
      return;
    }
    setCreateBusy(true);
    try {
      const parent = parentId === "" ? null : Number(parentId);
      await props.onCreate({
        name: trimmed,
        parentId: parent,
        ledgerType: props.ledgerType,
      });
      setName("");
      setParentId("");
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
          ref={nameRef}
          type="text"
          className="ledger-cell-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={onFieldKeyDown}
          aria-label="New category name"
          placeholder="Name"
        />
      </td>
      <td>
        <select
          className="ledger-cell-input"
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          onKeyDown={onFieldKeyDown}
          aria-label="New category parent"
        >
          <option value="">— Root —</option>
          {props.parentOptions.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {"\u00A0".repeat(cat.depth * 2)}
              {cat.name}
            </option>
          ))}
        </select>
      </td>
      <td className="col-actions">
        <form className="form-actions-row" onSubmit={onFormSubmit}>
          <button
            type="submit"
            className="btn-primary"
            disabled={createBusy}
            aria-label="Add category"
          >
            {createBusy ? "…" : "Add"}
          </button>
        </form>
      </td>
    </tr>
  );
}

