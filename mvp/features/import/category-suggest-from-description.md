---
id: MVP-025
status: done
domain: import
title: Import category suggest from description
---

# Import category suggest from description

## Summary

For cash CSV import rows **without** a `categoryPath`, suggest a category from (1) user `CategoryDescriptionRule` contains-patterns (longest wins) and (2) user-wide ledger history (exact normalized description + type). Rules override history. The UI always confirms (`descriptionMappings`: `map` | `none`). Mapping on commit upserts an exact-description rule.

## User value

Faster categorization of bank/card imports that lack category columns, with learnable rules and history, without silent auto-apply.

## Surfaces

| Kind | Location |
|------|----------|
| UI | `/accounts/:id` import confirm panel (description table); `/categories` Description rules |
| API | Import preview `descriptionSuggestions`; commit `descriptionMappings`; `/api/category-description-rules` CRUD |
| Code | `domain/categoryDescriptionSuggest.ts`, `CategoryDescriptionRule` |

## Acceptance

- [x] Suggest only for drafts without `categoryPath` and with non-empty description
- [x] Rules contain-match; longest pattern wins; history exact + latest
- [x] Rules beat history in merge
- [x] Confirm panel when path categories **or** description suggestions exist
- [x] Commit `map` upserts exact rule; `none` does not
- [x] Rules CRUD on Categories page + API

## Implementation notes

- Docs: [docs/how-to/import-csv-column-map.md](../../../docs/how-to/import-csv-column-map.md), [docs/how-to/budgets-and-categories.md](../../../docs/how-to/budgets-and-categories.md)
- Traceability: [docs/reference/requirements.md](../../../docs/reference/requirements.md)

## Out of scope / follow-ups

- ML / fuzzy matching
- Overwriting path categories from CSV
- Silent auto-apply without confirm
