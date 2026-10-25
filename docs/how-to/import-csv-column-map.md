---
diataxis: how-to
use_when: Import a bank or card CSV that is not a ledger export, by mapping columns on the account page
audience: both
---

# Import CSV with column mapping

Use this when **Upload CSV** on `/accounts/:id` is not a Finance Dashboard ledger export (unknown header).

## Steps

1. Open the account ledger and choose **Upload CSV**.
2. If the file matches the known ledger header, the usual category-mapping flow runs (no column step).
3. Otherwise a **Map CSV columns** panel appears:
   - Optionally **Use saved preset** (account-scoped). A matching preset is preselected when its header names appear in the CSV.
   - Map **Date** and **Amount** (required).
   - Optionally map Description, Type (`INCOME`/`EXPENSE`), and Category path.
   - If Type is not mapped, choose **Amount sign meaning**:
     - **Negative = expense** — typical bank / ROR statements.
     - **Negative = income** — typical credit-card statements (charges positive).
   - **Save as preset** / **Update selected** / **Delete selected** to persist the mapping for this account (header names stored, not column indices).
4. Review the sample rows (computed type and absolute amount), then **Continue**.
5. Confirm categories when needed:
   - **Category paths** from the CSV (map / create / none).
   - **Descriptions without a path** — suggested from your description rules (preferred) or past ledger history; choose map or none for each unique description+type. Mapping saves an exact-description rule for next time.
6. Confirm import. Ledger amounts are always stored as positive majors with `INCOME` / `EXPENSE`. Auto-commit without the confirm panel only when there are neither path categories nor description suggestions.

## Duplicates

Re-uploading the same (or overlapping) statement **skips** rows that already match a cash transaction on the account: same UTC day, type, amount, and normalized description. Preview/commit list those rows under `skippedDuplicates`. Identical rows twice in one file: the first imports, the rest are duplicates. The same rules apply to fixed ledger-header CSV imports.

## Description rules

Manage contains-patterns on **Categories → Description rules** (`/api/category-description-rules`). A rule matches when the normalized import description contains the pattern (longest pattern wins). Confirming a mapped description on import also upserts an exact-pattern rule. See [budgets-and-categories.md](budgets-and-categories.md).

## Notes

- Separators `,` / `;` / tab are detected from the header line.
- Dates: ISO (`YYYY-MM-DD`) or `DD.MM.YYYY` / `DD/MM/YYYY`.
- Presets are **per account** (not a global `/import/presets` catalog — that remains FR-047). Bank-specific `/import` (FR-019) is separate.

## API

| Step | Endpoint |
|------|----------|
| Headers + suggestions + match | `POST /api/accounts/:id/transactions/import/columns/preview` (`matchingPresetId`) |
| List / create / update / delete presets | `…/import-presets` |
| Normalize → category + description preview | `POST …/import/columns/apply` |
| Commit | `POST …/import/columns/commit` (`categoryMappings` + `descriptionMappings`) |
| Description rules CRUD | `/api/category-description-rules` |

See [api.md](../reference/api.md).
