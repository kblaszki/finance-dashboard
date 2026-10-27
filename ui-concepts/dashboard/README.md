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
| 06 | [Executive overview](06-executive-overview/) | Jaki jest pełny obraz dziś? | Net-worth trajectory | Balanced daily overview | Medium; many modules |
| 07 | [Goals journey](07-goals-journey/) | Do czego prowadzą moje pieniądze? | Financial-independence goal | Goal-driven users and planning | Low; requires goal data |
| 08 | [Editorial insights](08-editorial-insights/) | Co się zmieniło i dlaczego? | Narrative weekly briefing | Users who prefer explanation over controls | Low; less operational |
| 09 | [Command center](09-command-center/) | Gdzie wymagana jest kontrola? | Dense live telemetry | Power users and large portfolios | High for casual users |
| 10 | [Personal bento](10-personal-bento/) | Co jest ważne właśnie dla mnie? | Adaptive modular overview | Broadest mainstream appeal | Medium; personalization needed |

## Suggested discussion prompts

1. Which **first question** should `/dashboard` own vs `/statistics` vs future `/portfolio`?
2. Strong mainstream candidates: **06** (structured executive) and **10** (friendly bento).
3. Strong differentiated candidates: **07** (goals) and **08** (editorial).
4. Do not implement React until one row (or hybrid) is chosen.

## Shared assets

- [`_shared/tokens.css`](_shared/tokens.css) — concept palette (independent of `frontend` tokens)
- [`_shared/base.css`](_shared/base.css) — mock app shell
