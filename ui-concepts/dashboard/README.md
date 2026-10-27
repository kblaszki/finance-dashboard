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
| 11 | [Calm executive](11-calm-executive/) | Czy wszystko jest w porządku? | Restrained net-worth curve | Executive overview without noise | Low |
| 12 | [Goal focus](12-goal-focus/) | Jak blisko jest najważniejszy cel? | Single dominant goal | Users motivated by one near-term objective | Low |
| 13 | [Wealth journey](13-wealth-journey/) | Dokąd prowadzi wzrost majątku? | Wealth curve with milestones | Joining current wealth to future goals | Medium |
| 14 | [Morning brief](14-morning-brief/) | Co muszę wiedzieć w 30 sekund? | Daily status sentence | Low-frequency, calm engagement | Very low |
| 15 | [Family compass](15-family-compass/) | Czy plan rodziny jest bezpieczny? | Household plan strength | Shared household finances | Medium |
| 16 | [Retirement timeline](16-retirement-timeline/) | Kiedy praca stanie się opcjonalna? | Freedom date countdown | Long-horizon planning | Medium |
| 17 | [Founder finance](17-founder-finance/) | Jaki jest obraz prywatny i firmowy? | Combined personal position | Founders / self-employed users | High |
| 18 | [Quiet luxury](18-quiet-luxury/) | Jaki jest jeden sygnał? | Premium single number | Maximum calm and confidence | Very low |
| 19 | [Milestone map](19-milestone-map/) | Jaki jest kolejny przystanek? | Visual journey map | Goal-oriented, visual users | Medium |
| 20 | [Adaptive home](20-adaptive-home/) | Jaka jest najlepsza decyzja teraz? | Recommended monthly split | Personalized financial guidance | Medium |
| 21 | [Emerald glass](21-emerald-glass/) | Executive 06 in glass style | Net-worth chart + core KPIs | Premium dark interface | Medium |
| 22 | [Nordic light](22-nordic-light/) | Executive 06 in Nordic style | Net-worth chart + core KPIs | Maximum daytime readability | Low |
| 23 | [Midnight aurora](23-midnight-aurora/) | Executive 06 in aurora style | Net-worth chart + core KPIs | Immersive dark-mode users | Medium |
| 24 | [Warm editorial](24-warm-editorial/) | Executive 06 in editorial style | Net-worth chart + core KPIs | Human, less “software-like” finance | Low |
| 25 | [Neo brutalist](25-neo-brutalist/) | Executive 06 in brutalist style | Net-worth chart + core KPIs | Bold, distinctive brand direction | High |
| 26 | [Soft gradient](26-soft-gradient/) | Executive 06 in consumer style | Net-worth chart + core KPIs | Friendly mainstream product | Medium |

## Suggested discussion prompts

1. Which **first question** should `/dashboard` own vs `/statistics` vs future `/portfolio`?
2. Strong mainstream candidates: **06** (structured executive) and **10** (friendly bento).
3. Strong differentiated candidates: **07** (goals) and **08** (editorial).
4. New hybrids closest to the brief: **11** (06+05), **13** (06+07), **20** (06+07+05).
5. CSS-only executive comparison: **21–26** share the same information architecture. This isolates visual-style preference from content preference.
6. Do not implement React until one row (or hybrid) is chosen.

## Shared assets

- [`_shared/tokens.css`](_shared/tokens.css) — concept palette (independent of `frontend` tokens)
- [`_shared/base.css`](_shared/base.css) — mock app shell
