---
id: MVP-016
status: done
domain: budgets-categories
title: Categories CSV export and merge import
---

# Categories CSV export and merge import

## Summary

Export and import the user category tree as `path,ledgerType` CSV. Import merges into the existing tree (skip matches, create missing).

## User value

Move or restore a custom category taxonomy between environments without retyping nested paths.

## Surfaces

| Kind | Location |
|------|----------|
| UI | `/categories` — Download CSV / Upload CSV |
| API | `GET /api/categories/export`, `POST …/import/preview`, `POST …/import` |
| Code | `categoriesCsv.ts`, `categoriesImport.ts`, `categoriesRoutes.ts`, `categoriesApi` |

## Acceptance

- [x] Export includes all owned categories as full paths + ledgerType
- [x] Import preview reports existing vs to-create
- [x] Import creates missing paths; skips exact path+ledgerType
- [x] Conflicting ledgerType on an owned path → 400
- [x] No wipe/delete on import; tenancy scoped

## Implementation notes

- Docs: [docs/reference/api.md](../../../docs/reference/api.md), [docs/how-to/budgets-and-categories.md](../../../docs/how-to/budgets-and-categories.md)

## Out of scope / follow-ups

- Replace/wipe tree
- Rename mapping UI
- Bundled ledger+categories package
