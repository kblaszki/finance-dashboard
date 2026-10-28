# Categories concepts

Static concepts for comparing shipped workflows without changing the production frontend.

| No. | Direction | Information architecture | State emphasis |
|---|---|---|---|
| 01 | [Three-lane taxonomy](01-three-lane-taxonomy/) | Parallel lanes + inline create | Populated/edit |
| 02 | [Segmented tree](02-segmented-tree/) | Focused tree + segment switch | Blocked deletion |
| 03 | [Explorer inspector](03-explorer-inspector/) | Master–detail explorer | Reparent/edit |
| 04 | [Dense taxonomy console](04-dense-taxonomy-console/) | Dense operations table | CSV preview |
| 05 | [Automation studio](05-automation-studio/) | Rules-first workspace | Rule automation |

## Shared constraints

- Static, responsive HTML/CSS with illustrative controls only.
- Mock data is coherent across topics: Kasia B., PLN, Food / Groceries, 2026 trip, and October 2026.
- Concepts use the authenticated shell and shared primitives from [`../_shared/`](../_shared/).
- Each demo links back to the [topic hub](./).
- The concepts only represent workflows documented as shipped; they do not add product behavior.
