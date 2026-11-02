import { Link } from "react-router-dom";
import type { Category } from "../../api/categoriesApi";
import type { CategoryBreakdown } from "../../api/statisticsApi";
import { rollupByParent } from "../../utils/statisticsRollup";
import { CategoryBars } from "../statistics/CategoryBars";

export function TopCategoriesCard(props: {
  breakdown: CategoryBreakdown;
  categories: Category[];
  currency: string;
  periodLabel: string;
}) {
  const { breakdown, categories, currency, periodLabel } = props;
  const rows = rollupByParent(breakdown.expense, currency, categories)
    .slice()
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));

  return (
    <article className="card dash-panel">
      <div className="chart-card-head">
        <div>
          <h2 className="section-title">Where money went</h2>
          <p className="muted chart-card-subtitle">
            Top expense categories · {periodLabel} · {currency} (native
            currency filter).
          </p>
        </div>
        <Link to="/statistics" className="btn-link">
          Open cashflow
        </Link>
      </div>
      <CategoryBars
        rows={rows}
        currency={currency}
        tone="negative"
        emptyLabel={`No ${currency} expenses in this period.`}
        maxRows={5}
      />
    </article>
  );
}
