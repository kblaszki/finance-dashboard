# Statistics concepts

Static concepts for comparing shipped workflows without changing the production frontend.

| No. | Direction | Information architecture | State emphasis |
|---|---|---|---|
| 01 | [Executive narrative](01-executive-narrative/) | Guided story | Current vs prior |
| 02 | [Analyst workstation](02-analyst-workstation/) | Dense analyst console | Controls/error |
| 03 | [Question-led tabs](03-question-led-tabs/) | Question-based tabs | Tabs/empty |
| 04 | [Comparison board](04-comparison-board/) | Current/prior comparison | Period comparison |
| 05 | [Category-first explorer](05-category-first-explorer/) | Tree-led analysis | Expanded tree |

## Shared constraints

- Static, responsive HTML/CSS with illustrative controls only.
- Mock data is coherent across topics: Kasia B., PLN, Food / Groceries, 2026 trip, and October 2026.
- Concepts use the authenticated shell and shared primitives from [`../_shared/`](../_shared/).
- Each demo links back to the [topic hub](./).
- The concepts only represent workflows documented as shipped; they do not add product behavior.
