import { useEffect, useState } from "react";
import type { Budget, BudgetInput } from "../api/budgetsApi";
import {
  createBudget,
  deleteBudget,
  fetchBudgets,
  updateBudget,
} from "../api/budgetsApi";
import { SUPPORTED_CURRENCIES, useCurrency } from "../state/currency";

function currentYearMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

const emptyForm: BudgetInput = {
  yearMonth: currentYearMonth(),
  category: "",
  limitAmount: 0,
  currency: "PLN",
};

function budgetLabel(category: string | null): string {
  return category ?? "Całkowity";
}

export function BudgetTable() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<BudgetInput>(emptyForm);
  const [filterMonth, setFilterMonth] = useState(currentYearMonth());
  const { currency: displayCurrency } = useCurrency();

  useEffect(() => {
    void load();
  }, [filterMonth]);

  async function load() {
    setLoading(true);
    try {
      const data = await fetchBudgets({ yearMonth: filterMonth });
      setBudgets(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await createBudget({
      yearMonth: form.yearMonth,
      category: form.category?.trim() ? form.category.trim() : null,
      limitAmount: form.limitAmount,
      currency: form.currency,
    });
    setForm({ ...emptyForm, yearMonth: filterMonth, currency: displayCurrency });
    await load();
  }

  async function handleDelete(id: number) {
    await deleteBudget(id);
    await load();
  }

  return (
    <div className="card">
      <div className="budget-filter">
        <label>
          Miesiąc
          <input
            type="month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
          />
        </label>
      </div>

      <form className="form-grid" onSubmit={handleSubmit}>
        <label>
          Miesiąc budżetu
          <input
            type="month"
            required
            value={form.yearMonth}
            onChange={(e) => setForm({ ...form, yearMonth: e.target.value })}
          />
        </label>
        <label>
          Kategoria (puste = całkowity)
          <input
            type="text"
            value={form.category ?? ""}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            placeholder="np. FOOD"
          />
        </label>
        <label>
          Limit
          <input
            type="number"
            required
            min={0}
            step="0.01"
            value={form.limitAmount}
            onChange={(e) => setForm({ ...form, limitAmount: Number(e.target.value) })}
          />
        </label>
        <label>
          Waluta
          <select
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <div className="form-actions">
          <button type="submit" className="btn-primary">
            Dodaj budżet
          </button>
        </div>
      </form>

      {loading ? (
        <p className="loading-state">Ładowanie…</p>
      ) : budgets.length === 0 ? (
        <p className="empty-state">Brak budżetów w wybranym miesiącu.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Kategoria</th>
                <th>Limit</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {budgets.map((b) => (
                <BudgetRow key={b.id} budget={b} onChanged={load} onDelete={handleDelete} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BudgetRow(props: {
  budget: Budget;
  onChanged: () => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const { budget, onChanged, onDelete } = props;
  const [limitAmount, setLimitAmount] = useState(budget.limitAmount);
  const [saving, setSaving] = useState(false);

  async function saveLimit() {
    if (limitAmount === budget.limitAmount) return;
    setSaving(true);
    try {
      await updateBudget(budget.id, { limitAmount });
      await onChanged();
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr>
      <td>{budgetLabel(budget.category)}</td>
      <td>
        <input
          type="number"
          min={0}
          step="0.01"
          value={limitAmount}
          onChange={(e) => setLimitAmount(Number(e.target.value))}
          onBlur={() => void saveLimit()}
          disabled={saving}
        />{" "}
        {budget.currency}
      </td>
      <td>
        <button type="button" className="btn-danger" onClick={() => void onDelete(budget.id)}>
          Usuń
        </button>
      </td>
    </tr>
  );
}
