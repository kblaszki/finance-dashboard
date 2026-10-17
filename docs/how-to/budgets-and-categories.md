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

1. Register (or `create-user` / `db:seed`) seeds flat roots (Salary, Other income, Food, Housing, Transport, Other, Internal transfer) with `ledgerType` `INCOME`, `EXPENSE`, or `TRANSFER`. There are no Income/Expense wrapper categories.
2. Open `/categories` (AppShell nav): **Income**, **Expense**, and **Transfers** sections, each with an inline create row (name + optional parent, Enter to add). Edit like the cash ledger: double-click Name or Parent, Enter to save, Escape or click outside to cancel (same-type reparent only). Delete from the Actions column; new roots inherit the section’s `ledgerType`.
3. API: `GET|POST /api/categories`, `PATCH|DELETE /api/categories/:id`.
4. Delete returns `409` when the category has children. Deleting a leaf clears `CashTransaction.categoryId` / `CashTransfer.categoryId` (`SetNull`).
5. **CSV:** Download / Upload on `/categories` (`GET /api/categories/export`, `POST …/import/preview`, `POST …/import`). Format `path,ledgerType` (`INCOME`\|`EXPENSE`\|`TRANSFER`). Import **merges**: existing path+type skipped, missing paths created; never deletes. Prefer importing the category tree before a ledger or transfers CSV when moving between environments.
6. Tag internal transfers on `/transfers` with a **Transfers** category (optional); both ledger legs show the same tag. Cashflow statistics still ignore transfer legs.

## Tag a cash transaction (category)

1. Open an account ledger at `/accounts/:id`.
2. On create, optionally pick a category whose `ledgerType` matches the row type (omit for uncategorized).
3. `POST /api/accounts/:accountId/transactions` accepts optional `categoryId` (same user, matching `ledgerType`). Multi-line splits are deferred (out of scope for now).

## Free-form tags (many per cash row)

Categories remain a single optional label. Tags are a separate flat list for multiple labels on `INCOME`/`EXPENSE` only (not transfer legs).

1. Manage tags on `/tags` (create, rename, delete). Deleting a tag removes join rows; transactions stay.
2. On the account ledger, use the **Tags** multi-select on create or double-click the Tags cell to edit (`tagIds`).
3. API: `GET|POST /api/tags`, `PATCH|DELETE /api/tags/:id`; cash create/PATCH accept optional `tagIds: number[]`. Ledger/transfers CSV and statistics do not include tags yet.
