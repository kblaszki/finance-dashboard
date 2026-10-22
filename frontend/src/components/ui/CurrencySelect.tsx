import { Link } from "react-router-dom";
import { useCurrency } from "../../state/currency";

export function CurrencySelect() {
  const { currencies, currency, setCurrency } = useCurrency();

  if (currencies.length === 0) {
    return (
      <div className="currency-select">
        <span className="currency-select-label">Currency</span>
        <Link to="/accounts" className="link-button">
          Create an account
        </Link>
      </div>
    );
  }

  return (
    <label className="currency-select">
      <span className="currency-select-label">Currency</span>
      <select
        value={currency}
        onChange={(e) => setCurrency(e.target.value)}
      >
        {currencies.map((code) => (
          <option key={code} value={code}>
            {code}
          </option>
        ))}
      </select>
    </label>
  );
}
