import {
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createCategory,
  type Category,
  type CategoryLedgerType,
} from "../../api/categoriesApi";

export const NEW_CATEGORY_VALUE = "__new__";

export function CategorySelectWithCreate(props: {
  value: string;
  options: Category[];
  ledgerType: CategoryLedgerType;
  disabled?: boolean;
  autoFocus?: boolean;
  "aria-label"?: string;
  onChange: (categoryId: string) => void;
  onCategoryCreated: (category: Category) => void;
  onError: (message: string | null) => void;
  onKeyDown?: (e: KeyboardEvent) => void;
  onBlur?: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [createdLocal, setCreatedLocal] = useState<Category | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const suppressBlurRef = useRef(false);

  useEffect(() => {
    if (!creating) return;
    nameRef.current?.focus({ preventScroll: true });
  }, [creating]);

  const options = useMemo(() => {
    if (!createdLocal) return props.options;
    if (props.options.some((c) => c.id === createdLocal.id)) {
      return props.options;
    }
    return [...props.options, createdLocal].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [props.options, createdLocal]);

  function onSelectChange(next: string) {
    if (next === NEW_CATEGORY_VALUE) {
      suppressBlurRef.current = true;
      props.onError(null);
      setCreating(true);
      setName("");
      return;
    }
    props.onChange(next);
  }

  function handleSelectBlur() {
    if (suppressBlurRef.current) {
      suppressBlurRef.current = false;
      return;
    }
    props.onBlur?.();
  }

  function cancelCreate() {
    setCreating(false);
    setName("");
    setBusy(false);
  }

  async function saveCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      props.onError("Category name required");
      return;
    }
    setBusy(true);
    props.onError(null);
    try {
      const created = await createCategory({
        name: trimmed,
        ledgerType: props.ledgerType,
      });
      setCreatedLocal(created);
      props.onCategoryCreated(created);
      props.onChange(String(created.id));
      cancelCreate();
    } catch (err) {
      props.onError(err instanceof Error ? err.message : "Create category failed");
      setBusy(false);
    }
  }

  function onNameKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      cancelCreate();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      void saveCreate();
    }
  }

  if (creating) {
    return (
      <span className="category-create-inline form-actions-row">
        <input
          ref={nameRef}
          type="text"
          className="ledger-cell-input"
          value={name}
          disabled={busy || props.disabled}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={onNameKeyDown}
          aria-label="New category name"
          placeholder="Category name"
        />
        <button
          type="button"
          className="btn-primary"
          disabled={busy || props.disabled}
          onClick={() => void saveCreate()}
        >
          {busy ? "…" : "Save"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={busy || props.disabled}
          onClick={cancelCreate}
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <select
      className="ledger-cell-input"
      value={props.value}
      disabled={props.disabled}
      autoFocus={props.autoFocus}
      onChange={(e) => onSelectChange(e.target.value)}
      onKeyDown={props.onKeyDown}
      onBlur={handleSelectBlur}
      aria-label={props["aria-label"] ?? "Category"}
    >
      <option value="">—</option>
      {options.map((cat) => (
        <option key={cat.id} value={cat.id}>
          {cat.name}
        </option>
      ))}
      <option value={NEW_CATEGORY_VALUE}>+ New category…</option>
    </select>
  );
}
