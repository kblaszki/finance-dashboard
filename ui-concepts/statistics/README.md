# Statistics concepts

Static concepts for comparing shipped workflows and proposed Statistics modules without changing the production frontend.

| No. | Direction | Information architecture | State emphasis |
|---|---|---|---|
| 01 | [Executive narrative](01-executive-narrative/) | Guided story | Current vs prior |
| 02 | [Analyst workstation](02-analyst-workstation/) | Dense analyst console | Controls/error |
| 03 | [Question-led tabs](03-question-led-tabs/) | Question-based tabs | Tabs/empty |
| 04 | [Comparison board](04-comparison-board/) | Current/prior comparison | Period comparison |
| 05 | [Category-first explorer](05-category-first-explorer/) | Tree-led analysis | Expanded tree |
| 06 | [Spending health](06-spending-health/) | Explainable scorecard | Normal/warning signals |
| 07 | [Anomaly radar](07-anomaly-radar/) | Review inbox + evidence | Severity/acknowledge |
| 08 | [Cashflow forecast](08-cashflow-forecast/) | 90-day projection | Confidence/low balance |
| 09 | [Recurring commitments](09-recurring-commitments/) | Inventory + renewal rail | Price change/resolved |
| 10 | [Goal projections](10-goal-projections/) | Goal workspace | Illustrative scenarios |
| 11 | [Merchant patterns](11-merchant-patterns/) | List + merchant inspector | Focused evidence |
| 12 | [Year-end review](12-year-end-review/) | Annual report story | Incomplete/export-ready |
| 13 | [Scenario lab](13-scenario-lab/) | Controls + comparison | Before/after uncertainty |
| 14 | [Cashflow calendar](14-cashflow-calendar/) | Calendar + day detail | Known/projected events |
| 15 | [Data quality center](15-data-quality-center/) | Audit + cleanup queue | Action/resolved |

## Shipped-workflow concepts · 01–05

- Reframe period KPIs, cashflow, category, and tag workflows already represented by the product.
- Do not imply capabilities beyond the current Statistics surface.

## Proposed module concepts · 06–15

- Every demo visibly identifies itself as a concept proposal requiring new data or APIs.
- Forecasts, scores, anomalies, recurrence, and scenarios are illustrative; they do not claim accuracy, fraud detection, personalized advice, or guaranteed outcomes.
- Proposed concepts can explore new models and workflows, but remain static and separate from production.

## Constraints shared by all concepts

- Static, responsive HTML/CSS with illustrative controls only.
- Mock data is coherent across topics: Kasia B., PLN, Food / Groceries, 2026 trip, and October 2026.
- Concepts use the authenticated shell and shared primitives from [`../_shared/`](../_shared/).
- Each demo links back to the [topic hub](./).
