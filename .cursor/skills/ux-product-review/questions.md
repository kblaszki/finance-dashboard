# Preference question bank

Use with [SKILL.md](SKILL.md) Step 6. Ask only questions whose answer changes the proposal. Put the option supported by Steps 3–5 evidence first and label it `(Recommended)`. Write questions in the user's language; keep option ids in English.

## Focus and audience

- **dashboard_focus** — What should the dashboard answer first?
  - Spending this month (Q1–Q3) · Wealth and savings growth (Q4–Q5) · Balanced split · Configurable order
- **primary_device** — Where will the app be used most?
  - Desktop · Phone · Both equally
- **density** — Preferred information density?
  - Compact, data-dense (power user) · Airy cards with fewer numbers · Mixed: airy dashboard, dense tables

## Periods and comparisons

- **default_period** — Default reporting period?
  - Current calendar month · Rolling last 30 days · Last full month
- **comparison_baseline** — What should KPIs compare against?
  - Previous period · Average of last 3/6/12 months · Same month last year · Budget/target (needs budgets)

## Planning features

- **budgets** — Do you want spending limits per category?
  - Yes, monthly budgets per category · Only a total monthly limit · No, tracking only
- **goals** — Savings goals with progress (e.g. emergency fund)?
  - Yes · Later · No
- **recurring** — Detect and list recurring payments / subscriptions?
  - Yes · No

## Information architecture

- **organize_pages** — Categories, Tags and Description rules:
  - Merge into one "Organize" page with tabs · Move under Settings · Keep separate pages
- **statistics_split** — Statistics page:
  - Split into Spending and Cashflow/Savings pages · Keep one page with tabs · Keep as is
- **wealth_hub** — Accounts, holdings and Markets:
  - One "Wealth" area (accounts + investments + watchlist) · Keep Accounts and Markets separate
- **transactions_view** — Global "All transactions" list across accounts with search?
  - Yes, as a main nav item · Only inside each account (as today) · Both

## Visualization preferences

- **category_chart** — Spending composition shown as:
  - Sorted horizontal bars · Donut with top 5 + Other · Treemap
- **cashflow_chart** — Income vs expenses shown as:
  - Monthly bars + net savings line · Sankey flow for a period · Both
- **net_worth_detail** — Net worth chart detail:
  - Total only · Stacked by account type · Assets vs liabilities

## Trust and privacy

- **privacy_mode** — Option to hide/blur amounts (screen sharing, public places)?
  - Yes · No
- **show_fx_details** — Show FX rates and as-of dates next to converted totals?
  - Always visible · On hover/tap · Hidden
