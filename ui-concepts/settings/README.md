# Settings concepts

Static concepts for comparing shipped workflows without changing the production frontend.

| No. | Direction | Information architecture | State emphasis |
|---|---|---|---|
| 01 | [Calm stack](01-calm-stack/) | Vertical card stack | Mixed success |
| 02 | [Anchored index](02-anchored-index/) | Sticky section index | Validation/error |
| 03 | [Preference dashboard](03-preference-dashboard/) | Status tile dashboard | Independent saves |
| 04 | [Account security split](04-account-security-split/) | Two-column separation | Security validation |
| 05 | [Focused workspace](05-focused-workspace/) | Single-task workspace | Save history |

## Shared constraints

- Static, responsive HTML/CSS with illustrative controls only.
- Mock data is coherent across topics: Kasia B., PLN, Food / Groceries, 2026 trip, and October 2026.
- Concepts use the authenticated shell and shared primitives from [`../_shared/`](../_shared/).
- Each demo links back to the [topic hub](./).
- The concepts only represent workflows documented as shipped; they do not add product behavior.
