---
diataxis: how-to
use_when: Manage category tree or tag cash transactions
audience: both
related_docs:
  - docs/reference/api.md
  - docs/reference/frontend.md
related_code:
  - backend/src/domain/categories.ts
  - backend/src/routes/categoriesRoutes.ts
  - frontend/src/pages/CategoriesPage.tsx
---

# Budgets and categories

Hub: [docs/README.md](../README.md).

This page covers the shipped category tree and optional cash tagging. Monthly budgets are still backlog.

## Category tree

1. Register (or `create-user` / `db:seed`) seeds a default Income / Expense tree.
2. Open `/categories` (AppShell nav) to create, rename, reparent, or delete.
3. API: `GET|POST /api/categories`, `PATCH|DELETE /api/categories/:id`.
4. Delete returns `409` when the category has children. Deleting a leaf clears `CashTransaction.categoryId` (`SetNull`).
5. Categories have no income/expense kind — any category may tag either ledger type.

## Tag a cash transaction

1. Open an account ledger at `/accounts/:id`.
2. On create, optionally pick a category (omit for uncategorized).
3. `POST /api/accounts/:accountId/transactions` accepts optional `categoryId` (same user). Multi-line splits are deferred (out of scope for now).
