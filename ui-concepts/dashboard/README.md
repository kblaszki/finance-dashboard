# Dashboard concepts

Hub: open [index.html](index.html) in a browser (`file://` or `npx serve ui-concepts` → `/dashboard/`).

Static mock data (PLN). Not wired to the API. Use this matrix when picking a direction for a future React `/dashboard` redesign.

| # | Demo | First question | Hero | Best when | Overload risk |
|---|------|----------------|------|-----------|---------------|
| 01 | [Wealth pulse](01-wealth-pulse/) | Ile mam (i w czym)? | Large net worth + Δ | User thinks in assets / buckets | Medium if cashflow also crowded in |
| 02 | [Cashflow rhythm](02-cashflow-rhythm/) | Czy stać mnie na ten miesiąc? | Savings rate + big chart | Budgeting / burn focus | High if chart + too many KPIs |
| 03 | [Portfolio cockpit](03-portfolio-cockpit/) | Co robią pozycje? | Invested value + P&amp;L | After holdings exist | High before market data ships |
| 04 | [Action inbox](04-action-inbox/) | Co zrobić dziś? | Alerts + CTAs | Setup / budgets / ops | Medium if alerts noisy |
| 05 | [Zen single number](05-zen-single-number/) | Jeden spokojny sygnał | One net worth | Stress reduction, glanceable | Low — details on demand |

## Suggested discussion prompts

1. Which **first question** should `/dashboard` own vs `/statistics` vs future `/portfolio`?
2. Hybrid candidates worth sketching next: **01+04** (wealth + alerts strip), **05→01** (zen default, expand to wealth).
3. Do not implement React until one row (or hybrid) is chosen.

## Shared assets

- [`_shared/tokens.css`](_shared/tokens.css) — concept palette (independent of `frontend` tokens)
- [`_shared/base.css`](_shared/base.css) — mock app shell
