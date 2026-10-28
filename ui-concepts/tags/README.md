# Tags concepts

Static concepts for comparing shipped workflows without changing the production frontend.

| No. | Direction | Information architecture | State emphasis |
|---|---|---|---|
| 01 | [Compact registry](01-compact-registry/) | Sortable table | Rename/delete |
| 02 | [Tag chip canvas](02-tag-chip-canvas/) | Touch chip canvas | Empty/touch |
| 03 | [Searchable command list](03-searchable-command-list/) | Search command list | Search/create |
| 04 | [Label card grid](04-label-card-grid/) | Responsive card grid | API error |
| 05 | [List inspector](05-list-inspector/) | Master–detail list | Delete confirmation |

## Shared constraints

- Static, responsive HTML/CSS with illustrative controls only.
- Mock data is coherent across topics: Kasia B., PLN, Food / Groceries, 2026 trip, and October 2026.
- Concepts use the authenticated shell and shared primitives from [`../_shared/`](../_shared/).
- Each demo links back to the [topic hub](./).
- The concepts only represent workflows documented as shipped; they do not add product behavior.
