---
id: FR-015
status: done
domain: budgets-categories
title: Category tree CRUD
---

# Category tree CRUD

## Summary

User category tree with defaults on register.

## User value

Nested labels for organizing cash; seeded Income/Expense defaults on new users.

## Surfaces

| Kind | Location |
|------|----------|
| Primary | /categories |

## Acceptance

- [x] Create/rename/reparent/delete categories (`parentId` tree)
- [x] Defaults seeded on register (and create-user / demo seed)

## Implementation notes

- Domain: `backend/src/domain/categories.ts`
- Routes: `backend/src/routes/categoriesRoutes.ts` → `/api/categories`
- UI: `frontend/src/pages/CategoriesPage.tsx`
- Docs: [docs/how-to/budgets-and-categories.md](../../../docs/how-to/budgets-and-categories.md)
- Traceability: [docs/reference/requirements.md](../../../docs/reference/requirements.md)
- Code map: [docs/meta/code-map.md](../../../docs/meta/code-map.md)

## Out of scope / follow-ups

- Category income/expense kind enforcement
- Monthly budgets (FR-017), auto-categorization (FR-034)
