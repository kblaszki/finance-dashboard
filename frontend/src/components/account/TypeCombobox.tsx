import type { RefObject, KeyboardEvent } from "react";
import type { CashTxType } from "../../api/transactionsApi";

export function TypeCombobox({
  type,
  typeInput,
  typeError,
  isOpen,
  activeIndex,
  options,
  inputRef,
  onInputChange,
  onFocus,
  onBlur,
  onKeyDown,
  onSelect,
}: {
  type: CashTxType;
  typeInput: string;
  typeError: string | null;
  isOpen: boolean;
  activeIndex: number;
  options: readonly CashTxType[];
  inputRef: RefObject<HTMLInputElement | null>;
  onInputChange: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onSelect: (option: CashTxType) => void;
}) {
  const active = options[activeIndex];
  return (
    <label className="cash-tx-category-field">
      Type
      <div className="combobox">
        <input
          ref={inputRef}
          type="text"
          value={typeInput}
          onChange={(e) => onInputChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={isOpen}
          aria-invalid={typeError ? true : undefined}
          aria-controls="cash-type-listbox"
          aria-activedescendant={
            isOpen && active ? `cash-type-option-${active}` : undefined
          }
          placeholder="INCOME or EXPENSE"
          autoComplete="off"
        />
        {isOpen && (
          <div className="combobox-menu" role="listbox" id="cash-type-listbox">
            {options.length > 0 ? (
              options.map((option, index) => (
                <button
                  key={option}
                  id={`cash-type-option-${option}`}
                  type="button"
                  role="option"
                  aria-selected={option === type}
                  className={`combobox-option ${
                    index === activeIndex ? "active" : ""
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelect(option);
                  }}
                >
                  <span className="combobox-option-name">{option}</span>
                </button>
              ))
            ) : (
              <p className="combobox-empty">No matching type.</p>
            )}
          </div>
        )}
      </div>
      {typeError && <p className="auth-error">{typeError}</p>}
    </label>
  );
}
