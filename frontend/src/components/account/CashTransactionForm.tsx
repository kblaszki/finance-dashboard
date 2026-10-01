import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  flattenCategoryTree,
  type Category,
} from "../../api/categoriesApi";
import {
  CASH_TX_TYPES,
  type CashTxType,
  type CreateCashTransactionInput,
} from "../../api/transactionsApi";
import { CategoryCombobox } from "./CategoryCombobox";
import { categoryIdsUnderRoot, rootNameForTxType } from "./categoryScope";
import {
  defaultOccurredAtValue,
  shiftOccurredAtByDays,
  shiftOccurredAtByHours,
} from "./occurredAt";
import { TypeCombobox } from "./TypeCombobox";

export function CashTransactionForm(props: {
  categories: Category[] | null;
  onSubmit: (input: CreateCashTransactionInput) => Promise<void>;
}) {
  const [type, setType] = useState<CashTxType>("INCOME");
  const [typeInput, setTypeInput] = useState("INCOME");
  const [typeError, setTypeError] = useState<string | null>(null);
  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [activeTypeIndex, setActiveTypeIndex] = useState(0);
  const [amount, setAmount] = useState("");
  const [occurredAt, setOccurredAt] = useState(defaultOccurredAtValue);
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [categoryInput, setCategoryInput] = useState("");
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);
  const typeRef = useRef<HTMLInputElement | null>(null);
  const amountRef = useRef<HTMLInputElement | null>(null);
  const categoryInputRef = useRef<HTMLInputElement | null>(null);
  const dateRef = useRef<HTMLInputElement | null>(null);
  const typeBlurTimer = useRef<number | null>(null);
  const categoryBlurTimer = useRef<number | null>(null);

  const categoryRows = useMemo(
    () => (props.categories ? flattenCategoryTree(props.categories) : []),
    [props.categories],
  );

  const typeScopedCategoryRows = useMemo(() => {
    const allowed = categoryIdsUnderRoot(
      props.categories ?? [],
      rootNameForTxType(type),
    );
    return categoryRows.filter((cat) => allowed.has(cat.id));
  }, [props.categories, categoryRows, type]);

  const filteredTypeOptions = useMemo(() => {
    const query = typeInput.trim().toLowerCase();
    if (!query) return [...CASH_TX_TYPES];
    return CASH_TX_TYPES.filter((option) =>
      option.toLowerCase().includes(query),
    );
  }, [typeInput]);

  const filteredCategoryRows = useMemo(() => {
    const query = categoryInput.trim().toLowerCase();
    if (!query) return typeScopedCategoryRows;
    return typeScopedCategoryRows.filter((cat) =>
      cat.name.toLowerCase().includes(query),
    );
  }, [categoryInput, typeScopedCategoryRows]);

  useEffect(() => {
    window.setTimeout(() => {
      typeRef.current?.focus();
    }, 0);
  }, []);

  useEffect(() => {
    return () => {
      if (typeBlurTimer.current) {
        window.clearTimeout(typeBlurTimer.current);
      }
      if (categoryBlurTimer.current) {
        window.clearTimeout(categoryBlurTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isTypeOpen) {
      setActiveTypeIndex(0);
      return;
    }
    setActiveTypeIndex((current) =>
      filteredTypeOptions.length === 0
        ? 0
        : Math.min(current, filteredTypeOptions.length - 1),
    );
  }, [filteredTypeOptions, isTypeOpen]);

  useEffect(() => {
    if (!isCategoryOpen) {
      setActiveCategoryIndex(0);
      return;
    }
    setActiveCategoryIndex((current) =>
      filteredCategoryRows.length === 0
        ? 0
        : Math.min(current, filteredCategoryRows.length - 1),
    );
  }, [filteredCategoryRows, isCategoryOpen]);

  function clearCategoryIfOutsideType(nextType: CashTxType) {
    if (categoryId === "") return;
    const allowed = categoryIdsUnderRoot(
      props.categories ?? [],
      rootNameForTxType(nextType),
    );
    if (!allowed.has(Number(categoryId))) {
      clearCategory();
    }
  }

  function selectType(nextType: CashTxType) {
    setType(nextType);
    setTypeInput(nextType);
    setTypeError(null);
    setIsTypeOpen(false);
    clearCategoryIfOutsideType(nextType);
  }

  function validateTypeInput(): boolean {
    const trimmed = typeInput.trim();
    const exactMatch = CASH_TX_TYPES.find(
      (option) => option.toLowerCase() === trimmed.toLowerCase(),
    );
    if (exactMatch) {
      selectType(exactMatch);
      return true;
    }
    setTypeError("Choose INCOME or EXPENSE from the list.");
    return false;
  }

  function handleTypeInputChange(value: string) {
    setTypeInput(value);
    setTypeError(null);
    setIsTypeOpen(true);
    const exactMatch = CASH_TX_TYPES.find(
      (option) => option.toLowerCase() === value.trim().toLowerCase(),
    );
    if (exactMatch) {
      setType(exactMatch);
      clearCategoryIfOutsideType(exactMatch);
    }
  }

  function handleTypeInputFocus() {
    if (typeBlurTimer.current) {
      window.clearTimeout(typeBlurTimer.current);
      typeBlurTimer.current = null;
    }
    setIsTypeOpen(true);
  }

  function handleTypeInputBlur() {
    typeBlurTimer.current = window.setTimeout(() => {
      setIsTypeOpen(false);
      validateTypeInput();
    }, 120);
  }

  function acceptActiveTypeOption(): boolean {
    if (!isTypeOpen || filteredTypeOptions.length === 0) return false;
    const active = filteredTypeOptions[activeTypeIndex]!;
    selectType(active);
    return true;
  }

  function handleTypeKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isTypeOpen) {
        setIsTypeOpen(true);
        return;
      }
      setActiveTypeIndex((current) =>
        filteredTypeOptions.length === 0
          ? 0
          : Math.min(current + 1, filteredTypeOptions.length - 1),
      );
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!isTypeOpen) {
        setIsTypeOpen(true);
        return;
      }
      setActiveTypeIndex((current) => Math.max(current - 1, 0));
      return;
    }
    if (e.key === "Escape") {
      setIsTypeOpen(false);
      return;
    }
    if (e.key === "Tab" && !e.shiftKey && acceptActiveTypeOption()) {
      e.preventDefault();
      window.setTimeout(() => amountRef.current?.focus(), 0);
      return;
    }
    if (e.key === "Enter" && isTypeOpen && filteredTypeOptions.length > 0) {
      e.preventDefault();
      acceptActiveTypeOption();
    }
  }

  function validateCategoryInput(): boolean {
    const trimmed = categoryInput.trim();
    if (trimmed === "") {
      setCategoryId("");
      setCategoryError(null);
      return true;
    }
    if (categoryId !== "") {
      const allowed = categoryIdsUnderRoot(
        props.categories ?? [],
        rootNameForTxType(type),
      );
      if (allowed.has(Number(categoryId))) {
        setCategoryError(null);
        return true;
      }
    }
    const exactMatch = typeScopedCategoryRows.find(
      (cat) => cat.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (exactMatch) {
      selectCategory(exactMatch.id, exactMatch.name);
      return true;
    }
    setCategoryError("Choose an existing category from the list.");
    return false;
  }

  function selectCategory(nextId: number | null, nextName: string) {
    setCategoryId(nextId == null ? "" : String(nextId));
    setCategoryInput(nextName);
    setCategoryError(null);
    setIsCategoryOpen(false);
  }

  function clearCategory() {
    setCategoryId("");
    setCategoryInput("");
    setCategoryError(null);
    setIsCategoryOpen(false);
  }

  function handleCategoryInputChange(value: string) {
    setCategoryInput(value);
    setCategoryId("");
    setCategoryError(null);
    setIsCategoryOpen(true);
  }

  function handleCategoryInputFocus() {
    if (categoryBlurTimer.current) {
      window.clearTimeout(categoryBlurTimer.current);
      categoryBlurTimer.current = null;
    }
    setIsCategoryOpen(true);
  }

  function handleCategoryInputBlur() {
    categoryBlurTimer.current = window.setTimeout(() => {
      setIsCategoryOpen(false);
      validateCategoryInput();
    }, 120);
  }

  function acceptActiveCategoryOption(): boolean {
    if (!isCategoryOpen || filteredCategoryRows.length === 0) return false;
    const active = filteredCategoryRows[activeCategoryIndex]!;
    selectCategory(active.id, active.name);
    return true;
  }

  function handleCategoryKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isCategoryOpen) {
        setIsCategoryOpen(true);
        return;
      }
      setActiveCategoryIndex((current) =>
        filteredCategoryRows.length === 0
          ? 0
          : Math.min(current + 1, filteredCategoryRows.length - 1),
      );
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!isCategoryOpen) {
        setIsCategoryOpen(true);
        return;
      }
      setActiveCategoryIndex((current) => Math.max(current - 1, 0));
      return;
    }
    if (e.key === "Escape") {
      setIsCategoryOpen(false);
      return;
    }
    if (e.key === "Tab" && !e.shiftKey && acceptActiveCategoryOption()) {
      e.preventDefault();
      window.setTimeout(() => dateRef.current?.focus(), 0);
      return;
    }
    if (e.key === "Enter" && isCategoryOpen && filteredCategoryRows.length > 0) {
      e.preventDefault();
      acceptActiveCategoryOption();
    }
  }

  function handleDateKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!e.ctrlKey) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setOccurredAt((current) =>
        shiftOccurredAtByDays(current || defaultOccurredAtValue(), -1),
      );
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setOccurredAt((current) =>
        shiftOccurredAtByDays(current || defaultOccurredAtValue(), 1),
      );
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setOccurredAt((current) =>
        shiftOccurredAtByHours(current || defaultOccurredAtValue(), 1),
      );
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOccurredAt((current) =>
        shiftOccurredAtByHours(current || defaultOccurredAtValue(), -1),
      );
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateErr(null);
    if (!validateTypeInput()) return;
    if (!validateCategoryInput()) return;
    setCreateBusy(true);
    try {
      await props.onSubmit({
        type,
        amount: Number(amount),
        occurredAt: occurredAt.trim() ? new Date(occurredAt).toISOString() : undefined,
        description: description.trim() ? description.trim() : null,
        categoryId: categoryId === "" ? null : Number(categoryId),
      });
      setAmount("");
      setDescription("");
      selectType("INCOME");
      clearCategory();
      setCreateErr(null);
      typeRef.current?.focus();
    } catch (err) {
      setCreateErr(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreateBusy(false);
    }
  }

  return (
    <section className="card form-section-gap">
      <h2 className="section-title">Add cash movement</h2>
      <form className="auth-form cash-tx-form" onSubmit={handleCreate}>
        <TypeCombobox
          type={type}
          typeInput={typeInput}
          typeError={typeError}
          isOpen={isTypeOpen}
          activeIndex={activeTypeIndex}
          options={filteredTypeOptions}
          inputRef={typeRef}
          onInputChange={handleTypeInputChange}
          onFocus={handleTypeInputFocus}
          onBlur={handleTypeInputBlur}
          onKeyDown={handleTypeKeyDown}
          onSelect={selectType}
        />
        <label>
          Amount
          <input
            ref={amountRef}
            type="number"
            step="0.01"
            min="0.01"
            inputMode="decimal"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <CategoryCombobox
          categoryId={categoryId}
          categoryInput={categoryInput}
          categoryError={categoryError}
          isOpen={isCategoryOpen}
          activeIndex={activeCategoryIndex}
          rows={filteredCategoryRows}
          inputRef={categoryInputRef}
          onInputChange={handleCategoryInputChange}
          onFocus={handleCategoryInputFocus}
          onBlur={handleCategoryInputBlur}
          onKeyDown={handleCategoryKeyDown}
          onSelect={selectCategory}
          onClear={clearCategory}
        />
        <label>
          Date
          <input
            ref={dateRef}
            type="datetime-local"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
            onKeyDown={handleDateKeyDown}
          />
        </label>
        <label>
          Description (optional)
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        {createErr && <p className="auth-error">{createErr}</p>}
        <button type="submit" className="btn-primary" disabled={createBusy}>
          {createBusy ? "Saving…" : "Add transaction (Enter)"}
        </button>
      </form>
    </section>
  );
}
