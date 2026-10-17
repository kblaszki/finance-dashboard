---
id: MVP-018
status: done
domain: budgets-categories
title: Cash transaction tags
---

# Cash transaction tags

## Summary

User-scoped flat tags with M:N assignment to cash ledger `INCOME`/`EXPENSE` rows. Manage on `/tags`; assign on the account ledger. Categories stay a single optional `categoryId`.

## User value

Label transactions with multiple free-form tags (e.g. Lidl + wakacje-2026) for purpose/context, while categories stay the spend type.

## Surfaces

| Kind | Location |
|------|----------|
| UI | `/tags` CRUD; ledger Tags column (multi-select) |
| API | `/api/tags`; cash tx `tagIds` on create/PATCH/list |
| Code | `tags.ts`, `tagsRoutes.ts`, `tagsApi.ts`, `TagsPage.tsx`, ledger components |

## Acceptance

- [x] Tag CRUD scoped to owner; unique name per user (case-insensitive)
- [x] Cash create/PATCH accept `tagIds` (replace); list returns `tagIds`
- [x] Delete tag cascades joins; transactions remain
- [x] Transfer legs ignore tags (`tagIds: []`)
- [x] Demo seed creates purpose tags (Lidl, wakacje-2026, …) and assigns them on matching expenses
- [x] Budgets / CSV unchanged (no tags in CSV)
- [x] Statistics: `GET /api/statistics/tag-breakdown` + Tags tab on `/statistics`

## Implementation notes

- Docs: [docs/reference/domain.md](../../../docs/reference/domain.md), [docs/reference/api.md](../../../docs/reference/api.md), [docs/how-to/budgets-and-categories.md](../../../docs/how-to/budgets-and-categories.md), [docs/how-to/dashboard-and-statistics.md](../../../docs/how-to/dashboard-and-statistics.md)

## Out of scope / follow-ups

- Tag colors / ledger filters
- Tags on transfers or in CSV
