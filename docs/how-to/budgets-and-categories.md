---
diataxis: how-to
use_when: Set up categories, budgets, alerts, or auto-categorization rules
audience: both
related_docs:
  - docs/reference/domain.md
  - docs/reference/api.md
related_code:
  - backend/src/categories.ts
  - backend/src/budgets.ts
  - backend/src/budgetAlerts.ts
  - backend/src/categorizationRules.ts
---

# Budgets and categories

Hub: [docs/README.md](../README.md).

## Categories

1. UI: `/categories` — tree CRUD (`parentId`, `sortOrder`).
2. Defaults seed on register (`ensureDefaultCategories`).
3. API: category CRUD under `/api/categories` (see [api.md](../reference/api.md)).
4. Optional `Transaction.categoryId`; legacy string `category` still used for dividends/interest.

## Categorization rules

1. Same page section or `GET/POST/PUT/DELETE /api/categorization-rules`.
2. Body: `{ categoryId, pattern, matchType?: contains|regex, priority?, active? }`.
3. Applied on bank CSV import ([import-csv.md](import-csv.md)).

## Budgets and alerts

1. UI: `/budgets` — monthly limits per category.
2. List: `GET /api/budgets?month=YYYY-MM` — includes `spent`, `pctUsed`.
3. Upsert: `PUT /api/budgets` — `{ categoryId, budgetMonth, amount, currency }`.
4. Delete: `DELETE /api/budgets/:id`.
5. Alerts (80%/100%): `GET /api/budgets/alerts?month=&currency=` — shown on dashboard (`BudgetAlertsBanner`).

| Area | Path |
|------|------|
| Domain | `categories.ts`, `budgets.ts`, `budgetAlerts.ts`, `categorizationRules.ts` |
| UI | `CategoriesPage`, `BudgetsPage`, dashboard banner |
