import { SUPPORTED_CURRENCIES, useCurrency } from '../state/currency'

export function CurrencySelect() {
  const { currency, setCurrency } = useCurrency()

  return (
    <div className="currency-select">
      <label>
        Waluta
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value as (typeof SUPPORTED_CURRENCIES)[number])}
        >
          {SUPPORTED_CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

