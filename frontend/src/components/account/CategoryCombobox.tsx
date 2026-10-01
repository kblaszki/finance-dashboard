import type { KeyboardEvent, RefObject } from "react";
import type { Category } from "../../api/categoriesApi";

export type CategoryOption = Category & { depth: number };

export function CategoryCombobox({
  categoryId,
  categoryInput,
  categoryError,
  isOpen,
  activeIndex,
  rows,
  inputRef,
  onInputChange,
  onFocus,
  onBlur,
  onKeyDown,
  onSelect,
  onClear,
}: {
  categoryId: string;
  categoryInput: string;
  categoryError: string | null;
  isOpen: boolean;
  activeIndex: number;
  rows: CategoryOption[];
  inputRef: RefObject<HTMLInputElement | null>;
  onInputChange: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onSelect: (id: number, name: string) => void;
  onClear: () => void;
}) {
  const active = rows[activeIndex];
  return (
    <label className="cash-tx-category-field">
      Category (optional)
      <div className="combobox">
        <input
          ref={inputRef}
          type="text"
          value={categoryInput}
          onChange={(e) => onInputChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={isOpen}
          aria-invalid={categoryError ? true : undefined}
          aria-controls="cash-category-listbox"
          aria-activedescendant={
            isOpen && active ? `cash-category-option-${active.id}` : undefined
          }
          placeholder="Type to search categories"
          autoComplete="off"
        />
        {categoryInput !== "" && (
          <button
            type="button"
            className="combobox-clear"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClear}
            aria-label="Clear category"
          >
            Clear
          </button>
        )}
        {isOpen && (
          <div className="combobox-menu" role="listbox" id="cash-category-listbox">
            {rows.length > 0 ? (
              rows.map((cat, index) => (
                <button
                  key={cat.id}
                  id={`cash-category-option-${cat.id}`}
                  type="button"
                  role="option"
                  aria-selected={String(cat.id) === categoryId}
                  className={`combobox-option ${
                    index === activeIndex ? "active" : ""
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelect(cat.id, cat.name);
                  }}
                >
                  <span
                    className="combobox-option-name"
                    style={{ paddingInlineStart: `${cat.depth * 0.9}rem` }}
                  >
                    {cat.name}
                  </span>
                  {cat.depth > 0 && (
                    <span className="combobox-option-meta">Nested</span>
                  )}
                </button>
              ))
            ) : (
              <p className="combobox-empty">No matching categories.</p>
            )}
          </div>
        )}
      </div>
      {categoryError && <p className="auth-error">{categoryError}</p>}
    </label>
  );
}
