import { useEffect, useState } from "react";
import type { BudgetProgress as BudgetProgressItem } from "../api/budgetsApi";
import { fetchBudgetProgress } from "../api/budgetsApi";
import { useCurrency } from "../state/currency";
import { formatMoney } from "../utils/format";

function currentYearMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function budgetLabel(category: string | null): string {
  return category ?? "Całkowity";
}

type Props = {
  yearMonth?: string;
};

export function BudgetProgress(props: Props) {
  const yearMonth = props.yearMonth ?? currentYearMonth();
  const { currency } = useCurrency();
  const [items, setItems] = useState<BudgetProgressItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void load();
  }, [currency, yearMonth]);

  async function load() {
    setLoading(true);
    try {
      const data = await fetchBudgetProgress({ currency, yearMonth });
      setItems(data);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <p className="loading-state">Ładowanie budżetów…</p>;
  }

  if (items.length === 0) {
    return (
      <p className="empty-state">
        Brak budżetów na {yearMonth}. Dodaj limit na stronie Budżety.
      </p>
    );
  }

  return (
    <div className="budget-progress-list">
      {items.map((item) => {
        const pct = Math.min(item.percentUsed, 100);
        const over = item.percentUsed > 100;
        return (
          <div key={item.id} className="budget-progress-item">
            <div className="budget-progress-header">
              <span className="budget-progress-label">{budgetLabel(item.category)}</span>
              <span className="budget-progress-amounts">
                {formatMoney(item.spent, item.currency)} / {formatMoney(item.limitAmount, item.currency)}
              </span>
            </div>
            <div className="budget-progress-track">
              <div
                className={`budget-progress-fill${over ? " budget-progress-over" : ""}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="budget-progress-meta">
              Pozostało: {formatMoney(item.remaining, item.currency)} ({item.percentUsed.toFixed(0)}%)
            </p>
          </div>
        );
      })}
    </div>
  );
}
