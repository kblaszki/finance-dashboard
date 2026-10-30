import type {
  CategoryBreakdown,
  TagBreakdown,
} from "../../api/statisticsApi";
import type { CategoryTreeStatRow } from "../../utils/categoryTreeStats";
import type { RollupRow } from "../../utils/statisticsRollup";
import { BreakdownPanel } from "./BreakdownPanel";
import { DetailTable } from "./DetailTable";
import { TagDetailTable } from "./TagDetailTable";

export type AnalysisView = "categories" | "tags";
export type CategoryFacet = "income" | "expense" | "transfer";
export type TagFacet = "income" | "expense";

export function StatisticsAnalysisSection(props: {
  analysisView: AnalysisView;
  categoryFacet: CategoryFacet;
  tagFacet: TagFacet;
  periodLabel: string;
  currency: string;
  breakdown: CategoryBreakdown | null | undefined;
  tagBreakdown: TagBreakdown | null | undefined;
  categoryFacetRows: RollupRow[];
  categoryDetailRows: CategoryTreeStatRow[];
  tagFacetRows: RollupRow[];
  onAnalysisViewChange: (view: AnalysisView) => void;
  onCategoryFacetChange: (facet: CategoryFacet) => void;
  onTagFacetChange: (facet: TagFacet) => void;
}) {
  const {
    analysisView,
    categoryFacet,
    tagFacet,
    periodLabel,
    currency,
    breakdown,
    tagBreakdown,
    categoryFacetRows,
    categoryDetailRows,
    tagFacetRows,
    onAnalysisViewChange,
    onCategoryFacetChange,
    onTagFacetChange,
  } = props;

  return (
    <section className="card form-section-gap stats-analysis">
      <div
        className="stats-segmented"
        role="tablist"
        aria-label="Breakdown view"
      >
        <button
          type="button"
          role="tab"
          aria-selected={analysisView === "categories"}
          className={
            analysisView === "categories"
              ? "stats-segmented__btn stats-segmented__btn--active"
              : "stats-segmented__btn"
          }
          onClick={() => onAnalysisViewChange("categories")}
        >
          Categories
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={analysisView === "tags"}
          className={
            analysisView === "tags"
              ? "stats-segmented__btn stats-segmented__btn--active"
              : "stats-segmented__btn"
          }
          onClick={() => onAnalysisViewChange("tags")}
        >
          Tags
        </button>
      </div>

      {analysisView === "categories" && breakdown && (
        <>
          <div
            className="stats-facet-tabs"
            role="tablist"
            aria-label="Category type"
          >
            {(
              [
                ["income", "Income"],
                ["expense", "Expense"],
                ["transfer", "Transfers"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={categoryFacet === value}
                className={
                  categoryFacet === value
                    ? "stats-facet-tabs__btn stats-facet-tabs__btn--active"
                    : "stats-facet-tabs__btn"
                }
                onClick={() => onCategoryFacetChange(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <BreakdownPanel
            title={
              categoryFacet === "income"
                ? "Income"
                : categoryFacet === "expense"
                  ? "Expense"
                  : "Transfers"
            }
            rows={categoryFacetRows}
            currency={currency}
            tone={
              categoryFacet === "income"
                ? "positive"
                : categoryFacet === "expense"
                  ? "negative"
                  : "neutral"
            }
            emptyLabel={`No ${categoryFacet} in ${periodLabel} for ${currency} accounts (unconverted; other currencies omitted).`}
            subtitle={`Root category rollup · ${periodLabel} · ${currency} accounts only`}
          />
          <DetailTable
            title={`${categoryFacet === "transfer" ? "Transfer" : categoryFacet === "income" ? "Income" : "Expense"} detail`}
            rows={categoryDetailRows}
            currency={currency}
          />
          <p className="muted stats-detail-hint">
            Category totals use {currency} ledger rows only — they are not
            NBP-converted across accounts.
            {categoryDetailRows.length > 0
              ? " Totals include nested subcategories."
              : ""}
          </p>
        </>
      )}

      {analysisView === "tags" && tagBreakdown && (
        <>
          <div
            className="stats-facet-tabs"
            role="tablist"
            aria-label="Tag type"
          >
            {(
              [
                ["income", "Income"],
                ["expense", "Expense"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tagFacet === value}
                className={
                  tagFacet === value
                    ? "stats-facet-tabs__btn stats-facet-tabs__btn--active"
                    : "stats-facet-tabs__btn"
                }
                onClick={() => onTagFacetChange(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <BreakdownPanel
            title={tagFacet === "income" ? "Income" : "Expense"}
            rows={tagFacetRows}
            currency={currency}
            tone={tagFacet === "income" ? "positive" : "negative"}
            emptyLabel={`No tagged ${tagFacet} in ${periodLabel} for ${currency} accounts (unconverted; other currencies omitted).`}
            subtitle={`By tag · ${periodLabel} · ${currency} accounts only`}
            byLabel="tag"
          />
          <p className="muted stats-detail-hint">
            Tag and category totals use {currency} ledger rows only — they are
            not NBP-converted across accounts.
          </p>
          <TagDetailTable
            title={`${tagFacet === "income" ? "Income" : "Expense"} by tag`}
            rows={
              tagFacet === "income"
                ? tagBreakdown.income
                : tagBreakdown.expense
            }
            untaggedTotal={
              tagFacet === "income"
                ? tagBreakdown.untagged.income
                : tagBreakdown.untagged.expense
            }
            untaggedCount={
              tagFacet === "income"
                ? tagBreakdown.untagged.incomeCount
                : tagBreakdown.untagged.expenseCount
            }
            currency={currency}
          />
        </>
      )}
    </section>
  );
}
