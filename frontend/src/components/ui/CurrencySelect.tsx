import { useCurrency } from "../../state/currency";

export function CurrencySelect() {
  const { currencies, currency, setCurrency } = useCurrency();

  return (
    <label className="currency-select">
      <span className="currency-select-label">Currency</span>
      <select
        value={currency}
        onChange={(e) => setCurrency(e.target.value)}
        disabled={currencies.length === 0}
      >
        {currencies.length === 0 ? (
          <option value="">—</option>
        ) : (
          currencies.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))
        )}
      </select>
    </label>
  );
}
