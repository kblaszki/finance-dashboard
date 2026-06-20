# Agent guide (finance-dashboard)

Token-aware index — use `@docs/...` for domain detail; do not duplicate [README.md](README.md) here.

## Docs (on-demand)

| Doc | Use when |
|-----|----------|
| [docs/architecture.md](docs/architecture.md) | Auth, FX, request flow, where code lives |
| [docs/fullstack-architecture-practices.md](docs/fullstack-architecture-practices.md) | Principles for structuring fullstack apps; patterns illustrated with this repo |
| [docs/domain.md](docs/domain.md) | Prisma models (Account, HoldingLot, valuations) |
| [docs/api.md](docs/api.md) | REST route catalog |
| [docs/frontend.md](docs/frontend.md) | Routes, API clients, UI patterns |

## Cursor rules

- Always: `.cursor/rules/golden-rule.mdc`, `project-context.mdc`
- On file match: `backend.mdc`, `frontend.mdc`, `docs-maintenance.mdc`, `markdown.mdc`
- Human setup: [README.md](README.md)

## Skills (manual)

| Skill | Use when |
|-------|----------|
| [.cursor/skills/fullstack-architecture-review/SKILL.md](.cursor/skills/fullstack-architecture-review/SKILL.md) | Periodic fullstack architecture / practices audit; output is a prioritized remediation plan for delegation |

## Recipes

**New API endpoint**

1. Handler in `backend/src/routes/<area>Routes.ts` (wire in `backend/src/app.ts`; match existing patterns: `requireAuth`, `userId`, `toNumber`, `normalizeCurrency` from `fx.ts`).
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

**Brokerage / FX work**

- Positions: `HoldingLot` on `Account` (`BROKERAGE`); charts from `AccountValuationDaily` / `HoldingValuationDaily`.
- FX: `backend/src/fx.ts` only.

**Tests**

- `npm test` from repo root.
- Unit: `backend/src/*.test.ts`; integration/golden/HTTP: `backend/test/`.

## Do not commit

- `backend/.env`, `**/dev.db`, local SQLite files
