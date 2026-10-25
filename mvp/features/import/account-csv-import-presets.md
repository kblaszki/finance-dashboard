---
id: MVP-023
status: done
domain: import
title: Account CSV import column presets
---

# Account CSV import column presets

## Summary

On `/accounts/:id` flexible CSV import, the user can save, load, update, and delete column-mapping presets scoped to that account. Presets store header names (and `amountSignMode` when type is unmapped). Column preview returns `matchingPresetId` when a preset’s headers match the uploaded file.

## User value

Repeat statement imports without remapping columns every time; bank vs credit-card sign modes stay on the right account.

## Surfaces

| Kind | Location |
|------|----------|
| UI | `/accounts/:id` — `ImportColumnMappingPanel` |
| API | `GET/POST/PATCH/DELETE /api/accounts/:id/import-presets`; `matchingPresetId` on columns preview |
| Code | `CsvImportPreset`; `domain/csvImportPresets.ts`; `csvImportPresetsRoutes.ts` |

## Acceptance

- [x] Create/list/update/delete presets per owned account
- [x] Mapping stored as header names
- [x] Panel load / save / overwrite / delete
- [x] Preview suggests matching preset when headers align
- [x] No global `/import/presets` page (FR-047 remains planned)

## Implementation notes

- Docs: [docs/how-to/import-csv-column-map.md](../../../docs/how-to/import-csv-column-map.md)
- Traceability: [docs/reference/requirements.md](../../../docs/reference/requirements.md)
- Code map: [docs/meta/code-map.md](../../../docs/meta/code-map.md)

## Out of scope / follow-ups

- FR-047 import presets catalog + MVP-020 `/import` wiring
- ImportBatch / FR-019 bank parsers
- Category-mapping memory
