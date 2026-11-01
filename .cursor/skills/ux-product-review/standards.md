# UX standards for a personal-finance app

Use with [SKILL.md](SKILL.md). Each section gives **criteria** and **how to check**. Cite the section number (§N) in findings.

Reference products for patterns (not for copying visuals): YNAB, Monarch Money, Copilot Money, Lunch Money, Empower (Personal Capital), Revolut / bank apps' analytics tabs, Mint (historical).

## 1. Users, jobs and core questions

Default personas (adapt to the evidence):

- **Mindful spender** — wants to know where money goes, catch category creep and subscriptions, close each month feeling in control. Weekly 5-minute check, monthly review.
- **Saver / investor** — wants to see savings rate, net worth growth, allocation and investment performance. Glances weekly, deep-dives monthly/quarterly.

Core questions the UI must answer (each needs a clear home, ideally ≤ 1 click from the dashboard):

| # | Question | Ideal form |
|---|----------|------------|
| Q1 | Am I OK this month? (spent vs income / vs usual) | Hero number + delta vs previous period or average |
| Q2 | Where did my money go? | Ranked categories with amounts, share and change vs previous period |
| Q3 | What changed? (category up/down, unusual transactions) | Delta list sorted by absolute change; highlights |
| Q4 | How much do I save? | Savings amount and savings rate (% of income), trend over months |
| Q5 | Is my net worth growing? | Net worth line/area over time, change over period (abs + %) |
| Q6 | What do I own and where? | Allocation by account type / asset class; per-account balances |
| Q7 | How are my investments doing? | Value, gain/loss (abs + %), per holding |
| Q8 | What needs my attention? | Uncategorized transactions, failed imports, stale prices/FX, setup gaps |
| Q9 | What did I spend on X? | Search/filter by description, category, tag, date range |
| Q10 | Recurring costs / subscriptions | List of recurring payees with monthly cost (if data supports it) |

Frequency drives placement: daily/weekly questions belong on the dashboard; monthly questions on an analysis page; rare tasks (setup, CSV mapping, rules) in secondary navigation or settings.

## 2. Information architecture

Criteria:
- Top-level navigation ≤ 7 items, grouped by **user intent** (Overview, Spending/Cashflow, Wealth/Investments, Transactions, Organize, Settings), not by database model.
- Overview → Detail → Action: every summary number links to its drill-down (KPI → filtered list/chart).
- Configuration objects (categories, tags, description rules, presets) are secondary — grouped under one "Organize"/settings area unless used daily.
- Filters, period and selected tab live in the URL (shareable, back button works).
- One global period/currency concept, applied consistently and visibly labeled on every page that uses it.
- No dead ends: empty states and detail pages always offer the next step.

How: draw the current sitemap from `App.tsx` + `AppShell` nav; count clicks for each Q1–Q10; check that KPIs/chart segments are links.

## 3. Dashboard and glanceability

Criteria:
- **5-second test:** the user knows "how am I doing" without scrolling or reading body text.
- One hero area (largest card, top-left) for the most important metric; 3–6 supporting KPIs, not more.
- Every KPI has context: comparison (vs previous period, vs average, vs budget/target), direction with sign and color + icon/arrow (not color alone), optional sparkline.
- Inverted pyramid: summary → trends → breakdowns → recent activity. Tables at the bottom.
- Above the fold at 1440 x 900: hero + KPIs + one primary chart. On phone: hero + KPIs first.
- "Needs attention" items (Q8) are visible but compact and dismissible once resolved.
- No duplicate of a full analysis page on the dashboard — show the top 3–5 and link to the rest.

How: screenshot at 1440 x 900 and 390 x 844; list what is above the fold; check each KPI for comparison context.

## 4. Data visualization

Chart choice by question:

| Question type | Use | Avoid |
|---------------|-----|-------|
| Trend over time (net worth, balance) | Line / area; range selector (1M/6M/1Y/All) | Bars for long continuous series |
| Income vs expenses per month | Grouped or diverging bars + net line | Two separate charts |
| Composition (spending by category) | Horizontal bars sorted desc; donut only for ≤ 5–6 slices + "Other" | Pie with 10+ slices, 3D |
| Change vs previous period | Delta bars / bullet chart / table with arrows | Two donuts side by side |
| Budget/target vs actual | Progress bar / bullet chart | Gauge |
| Flow (income → categories → savings) | Sankey (only if it adds insight and no new lib needed) | — |
| Allocation | Donut or stacked 100% bar + legend with values | Unlabeled donut |
| Distribution over days | Calendar heatmap / column chart | — |

Criteria:
- Title states the insight or question ("Spending by category — Oct 2026"), axis/period/currency labeled.
- Bar charts start at zero; time axes have even intervals; no dual axes unless units clearly differ and both are labeled.
- Direct labels or legend with values; tooltip with formatted currency (`format.ts`) and date.
- Same category = same color across all charts (stable color assignment, not index-based per chart).
- Positive/negative semantics consistent (`--color-positive` / `--color-negative`) plus sign or arrow.
- High data-ink ratio: light gridlines, no decorative effects.
- Empty, loading and single-data-point states handled (no blank axis frame).
- Every chart answers a Q from §1; a chart that answers nothing is removed or merged.

How: list every chart (`rg -n 'ResponsiveContainer' frontend/src/components`), map to a question, check type against the table.

## 5. Finance-specific patterns

Criteria:
- **Savings rate** = (income − expenses) / income, shown monthly with trend.
- **Month-over-month and vs-average** comparisons for spending and categories.
- **Category drill-down:** category → subcategories → transactions, keeping the period.
- **Uncategorized inbox:** count + fast path to categorize (bulk or inline).
- **Net worth:** assets vs liabilities split, change over period, as-of date.
- **Investments:** market value, cost basis, unrealized gain/loss (abs + %), allocation; price as-of date.
- **Trust signals:** as-of timestamps, FX rate source/date (NBP), currency code next to converted totals, clear "converted" marker.
- **Number formatting:** locale-aware, tabular numerals, consistent decimals, compact notation for large values in charts (`12.3k`), sign explicit for deltas, currency always visible.
- **Transfers** are excluded from income/expense totals and visibly labeled as such.
- Optional: privacy mode (blur amounts), goals with progress, recurring/subscription detection, budgets — propose only when they answer a confirmed user need (see questions.md).

How: check `statisticsApi.ts` / `holdingsApi.ts` DTOs for fields needed; verify formatting in `frontend/src/utils/format.ts`; check labels on converted totals.

## 6. Visual hierarchy and layout

Criteria:
- Size and position reflect importance: F-pattern on desktop (top-left most important), single column priority order on phone.
- 12-column desktop grid; consistent card heights in a row; spans express weight (hero 8/12 + side 4/12, KPIs 3/12 each, etc.).
- One primary action per page, visually dominant (`btn-primary`); secondary actions quieter.
- Section headings describe content; consistent spacing between sections (`page-stack`).
- Progressive disclosure: advanced controls (CSV mapping, rules, column settings) collapsed or on secondary screens.
- Grouping by proximity and common region (Gestalt); related controls next to the data they affect (filters above their table/chart).

How: annotate screenshots with section order and spans; compare with the blueprint.

## 7. Interaction and feedback (Nielsen heuristics, condensed)

Criteria:
- Visibility of system status: loading per section (skeletons sized like content), success feedback after writes, sync/as-of state.
- Match the real world: finance vocabulary users know (Income, Expenses, Savings, Net worth), no internal terms (ledgerType, MTM) in UI copy.
- User control: undo or confirm for destructive actions; Escape cancels edits; filters easy to reset.
- Consistency: same action = same control and placement on every page (add, edit, delete, import, export).
- Error prevention: sensible defaults (today's date, last used account/type), validation before submit.
- Recognition over recall: show current period/filters; inline editing is discoverable (hint, icon, or edit affordance — not only double-click).
- Efficiency: keyboard support for frequent entry; bulk actions for categorizing; remembered preferences.
- Empty states explain value and give the next action (CTA), never just "No data".

## 8. Mobile and accessibility

Criteria:
- Phone: most important content first; wide tables become card lists or keep only key columns with horizontal scroll inside the wrapper; primary action reachable in the thumb zone.
- Navigation reachable in one tap (drawer or bottom nav for ≤ 5 primary destinations).
- Charts readable at 390px: fewer ticks, compact numbers, legend below.
- WCAG 2.2 AA: contrast, focus visible, color never the only cue, charts have a text alternative (summary sentence or data table), touch targets ≥ `--tap-target`.

## 9. Page rubric (score 1–5)

| Criterion | 5 means |
|-----------|---------|
| Clarity | Purpose obvious in 5 seconds; title and hero match the purpose |
| Glance | Key answer visible above the fold without interaction or mental math |
| Hierarchy | Order and size match importance; inverted pyramid |
| Data-vis | Every chart fits its question (§4), labeled, comparable, consistent colors |
| Action | Primary next step obvious; summaries link to drill-downs |
| Consistency | Same patterns as other pages (headers, filters, tables, states) |
| Mobile | Same answers reachable on phone in the same or fewer steps |

Scores ≤ 2 → at least a High finding; 3 → Medium.
