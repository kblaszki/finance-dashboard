---
# Product feature map (MVP)

Committed backlog of **product capabilities**: what exists, what is stubbed, and what is planned.

Technical FR→code traceability stays in [docs/reference/requirements.md](../docs/reference/requirements.md). Diátaxis how-tos stay under [docs/](../docs/). This tree is the **product checklist**.

## Layout

```text
mvp/
  README.md
  CHECKLIST.md              # master summary (all features + status)
  _templates/feature.md
  features/<domain>/*.md    # one file ≈ one capability
```

## Domains

| Folder | Scope |
|--------|--------|
| `auth` | Login, register, profile, password reset, HttpOnly JWT cookie |
| `accounts` | Account types, list/detail, metal grams |
| `cash-transfers` | Cash ledger, internal transfers |
| `holdings-trades` | Lots, asset trades, instruments, portfolio positions |
| `import` | CSV import, presets |
| `market-fx` | Market EOD, NBP FX |
| `dashboard-stats` | Dashboard, statistics, net worth KPIs |
| `budgets-categories` | Categories, budgets, rules, alerts |
| `income-liabilities` | Income events, coupons, liabilities |
| `property` | Real estate cash flows, sales, asset valuations |
| `tax` | PL tax stack |
| `automation-export` | Sync stubs, export, audit, attachments |
| `ops` | Health, private deploy tooling |

## Status values

| Status | Meaning |
|--------|---------|
| `done` | Shipped end-to-end as described |
| `in_progress` | Partial / active work |
| `stub` | Surface exists but intentionally incomplete |
| `planned` | Wanted; no meaningful implementation yet |

## Skills

| Skill | Use when |
|-------|----------|
| [mvp-add-feature](../.cursor/skills/mvp-add-feature/SKILL.md) | Add a new capability file + checklist row |
| [mvp-review](../.cursor/skills/mvp-review/SKILL.md) | Audit checklist vs files vs code |

Do **not** confuse with [mvp-scope-implementer](../.cursor/skills/mvp-scope-implementer/SKILL.md), which implements from a **local** `plans/<root>/` docs tree (`mvp/scope.md` + `requirements/`).

## Conventions

- English prose; LF line endings.
- Front matter required: `id`, `status`, `domain`, `title`.
- IDs: prefer `FR-xxx` / `NFR-xxx` from the requirements map; otherwise `MVP-xxx`.
- Keep feature files short; link to `docs/how-to/*` for recipes.
