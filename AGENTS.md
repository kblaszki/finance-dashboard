# Agent guide (finance-dashboard)

Token-aware index — open [docs/README.md](docs/README.md) for the Diátaxis compass; do not duplicate [README.md](README.md) here.

## Docs (on-demand)

### Meta

| Doc | Use when |
|-----|----------|
| [docs/README.md](docs/README.md) | Diátaxis hub and AI reading order |
| [docs/meta/code-map.md](docs/meta/code-map.md) | Domain → primary code paths |

### Tutorials

| Doc | Use when |
|-----|----------|
| [docs/tutorials/first-run.md](docs/tutorials/first-run.md) | First local install and login |
| [docs/tutorials/demo-seed.md](docs/tutorials/demo-seed.md) | Demo user + sample portfolio seed |

### How-to

| Doc | Use when |
|-----|----------|
| [docs/how-to/add-api-endpoint.md](docs/how-to/add-api-endpoint.md) | New REST endpoint end-to-end |
| [docs/how-to/add-prisma-model.md](docs/how-to/add-prisma-model.md) | Schema / model change |
| [docs/how-to/add-ui-page.md](docs/how-to/add-ui-page.md) | New UI page/route |
| [docs/how-to/run-tests-and-coverage.md](docs/how-to/run-tests-and-coverage.md) | Verify before finishing logic work |
| [docs/how-to/brokerage-and-fx.md](docs/how-to/brokerage-and-fx.md) | Brokerage positions / FX |
| [docs/how-to/import-csv.md](docs/how-to/import-csv.md) | Broker or bank CSV import |
| [docs/how-to/tax-year-workflow.md](docs/how-to/tax-year-workflow.md) | PL tax year review / close |
| [docs/how-to/internal-transfers.md](docs/how-to/internal-transfers.md) | Cross-account cash transfers |
| [docs/how-to/private-deploy.md](docs/how-to/private-deploy.md) | Private single-user deploy |

### Reference

| Doc | Use when |
|-----|----------|
| [docs/reference/api.md](docs/reference/api.md) | REST route catalog |
| [docs/reference/domain.md](docs/reference/domain.md) | Prisma models |
| [docs/reference/frontend.md](docs/reference/frontend.md) | UI routes and API clients |
| [docs/reference/testing.md](docs/reference/testing.md) | Test pyramid, coverage, CI |

### Explanation

| Doc | Use when |
|-----|----------|
| [docs/explanation/architecture.md](docs/explanation/architecture.md) | Auth, FX, request flow, modules |
| [docs/explanation/fullstack-practices.md](docs/explanation/fullstack-practices.md) | Fullstack practices rubric |
| [docs/explanation/tax-pl.md](docs/explanation/tax-pl.md) | PL tax assumptions |

## Cursor rules

- Always: `.cursor/rules/golden-rule.mdc`, `project-context.mdc`, `verification.mdc`
- On file match: `backend.mdc`, `frontend.mdc`, `docs-maintenance.mdc`, `markdown.mdc`
- Human setup: [README.md](README.md)

## Skills

| Skill | Use when |
|-------|----------|
| [.cursor/skills/docs-reader/SKILL.md](.cursor/skills/docs-reader/SKILL.md) | Daily AI doc reading — pick ≤3 files |
| [.cursor/skills/docs-author/SKILL.md](.cursor/skills/docs-author/SKILL.md) | Add a new Diátaxis page |
| [.cursor/skills/docs-audit/SKILL.md](.cursor/skills/docs-audit/SKILL.md) | Check docs vs code drift |
| [.cursor/skills/docs-sync-during-work/SKILL.md](.cursor/skills/docs-sync-during-work/SKILL.md) | **Required** — update docs in the same chunk as significant code changes |
| [.cursor/skills/fullstack-architecture-review/SKILL.md](.cursor/skills/fullstack-architecture-review/SKILL.md) | Periodic fullstack architecture audit |
| [.cursor/skills/mvp-scope-implementer/SKILL.md](.cursor/skills/mvp-scope-implementer/SKILL.md) | Implement MVP from local scope docs |

## Do not commit

- `backend/.env`, `**/dev.db`, local SQLite files
- `plans/` — local work-in-progress only (gitignored); never link to it from committed docs (`README.md`, `docs/*`, `AGENTS.md`)
