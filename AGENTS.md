# Agent guide (finance-dashboard)

Token-aware index — use `@docs/...` for domain detail; do not duplicate [README.md](README.md) here.

## Docs (on-demand)

| Doc | Use when |
|-----|----------|
| [docs/architecture.md](docs/architecture.md) | Auth, FX, request flow, where code lives |
| [docs/domain.md](docs/domain.md) | Prisma models, portfolios vs legacy positions |
| [docs/api.md](docs/api.md) | REST route catalog |
| [docs/frontend.md](docs/frontend.md) | Routes, API clients, UI patterns |

## Cursor rules

- Always: `.cursor/rules/golden-rule.mdc`, `project-context.mdc`
- On file match: `backend.mdc`, `frontend.mdc`, `docs-maintenance.mdc`, `markdown.mdc`
- Human setup: [README.md](README.md)

## Recipes

**New API endpoint**

1. Handler in `backend/src/app.ts` (match existing patterns: `requireAuth`, `userId`, `toNumber`, `normalizeCurrency`).
2. Client in `frontend/src/api/<area>Api.ts`.
3. One row in `docs/api.md`.

**Schema / model change**

1. Edit `backend/prisma/schema.prisma`.
2. `cd backend && npx prisma migrate dev --name <description>`.
3. Update `docs/domain.md` if relationships or meaning changed.

**New UI page**

1. Route + nav in `frontend/src/App.tsx`.
2. Component under `frontend/src/components/` or `pages/`.
3. Row in `docs/frontend.md`.

**Portfolio / FX work**

- Trades: `PortfolioTrade` + `Account` (BROKERAGE) — legacy `/api/portfolio*` aliases remain.
- FX: `backend/src/fx.ts` only.

## Do not commit

- `backend/.env`, `**/dev.db`, local SQLite files
