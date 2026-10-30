import type { CashflowRolling12m } from "../../api/statisticsApi";
import { KpiCard } from "../ui/KpiCard";
import { formatMoney } from "../../utils/format";

export function RollingCashflowStrip(props: {
  rolling: CashflowRolling12m;
  currency: string;
}) {
  const { rolling, currency } = props;

  return (
    <section className="card form-section-gap stats-rolling">
      <div className="stats-rolling-head">
        <h2 className="section-title">Rolling 12-month averages</h2>
        <p className="muted">
          Complete UTC months {rolling.fromMonth} → {rolling.toMonth} (
          {rolling.monthCount} months), converted to {currency} via NBP mids.
          Excludes the current month.
        </p>
      </div>
      <div className="kpi-grid">
        <KpiCard
          label={`Avg income · ${currency}`}
          value={formatMoney(rolling.avgIncome, currency)}
          tone="positive"
        />
        <KpiCard
          label={`Avg expense · ${currency}`}
          value={formatMoney(rolling.avgExpense, currency)}
          tone="negative"
        />
        <KpiCard
          label={`Avg net · ${currency}`}
          value={formatMoney(rolling.avgNet, currency)}
          tone={rolling.avgNet >= 0 ? "positive" : "negative"}
        />
      </div>
    </section>
  );
}
