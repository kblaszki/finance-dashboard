---
diataxis: meta
use_when: Documentation hub — Diátaxis compass and AI reading order
audience: both
---

# Documentation hub

Finance-dashboard docs follow [Diátaxis](https://diataxis.fr/): each page has one purpose.

| Mode | Need | Folder |
|------|------|--------|
| Tutorials | Learn by doing (first success) | [tutorials/](tutorials/) |
| How-to | Solve a concrete task | [how-to/](how-to/) |
| Reference | Look up facts (API, models, routes) | [reference/](reference/) |
| Explanation | Understand why | [explanation/](explanation/) |
| Meta | Agent maps (not a Diátaxis mode) | [meta/](meta/) |

## AI reading order

1. [AGENTS.md](../AGENTS.md) — which docs/skills to open
2. This hub — which Diátaxis mode
3. [meta/code-map.md](meta/code-map.md) — when locating **code** paths
4. At most **one** page from tutorials / how-to / reference / explanation
5. Then the code itself

Never load all docs. Prefer reference for facts, how-to for tasks, explanation for “why”, tutorials for onboarding.

## Human entry

- Local setup and install: [README.md](../README.md)
- First run walkthrough: [tutorials/first-run.md](tutorials/first-run.md)
- Private deploy: [how-to/private-deploy.md](how-to/private-deploy.md)
- Product feature map (done / planned): [mvp/CHECKLIST.md](../mvp/CHECKLIST.md)

## Tutorials

| Doc | Use when |
|-----|----------|
| [first-run.md](tutorials/first-run.md) | First local install and login |
| [demo-seed.md](tutorials/demo-seed.md) | Demo user + sample portfolio |

## How-to index

| Doc | Use when |
|-----|----------|
| [add-api-endpoint.md](how-to/add-api-endpoint.md) | New REST endpoint |
| [add-prisma-model.md](how-to/add-prisma-model.md) | Schema / model change |
| [add-ui-page.md](how-to/add-ui-page.md) | New UI page |
| [run-tests-and-coverage.md](how-to/run-tests-and-coverage.md) | Verification gate |
| [brokerage-and-fx.md](how-to/brokerage-and-fx.md) | Brokerage / FX work |
| [accounts-and-holdings.md](how-to/accounts-and-holdings.md) | Accounts, lots, trades |
| [import-csv.md](how-to/import-csv.md) | Broker or bank CSV import |
| [corporate-actions.md](how-to/corporate-actions.md) | Stock splits / CA |
| [position-transfers.md](how-to/position-transfers.md) | Securities between brokerages |
| [internal-transfers.md](how-to/internal-transfers.md) | Internal cash transfers |
| [income-and-coupons.md](how-to/income-and-coupons.md) | Dividends and coupons |
| [budgets-and-categories.md](how-to/budgets-and-categories.md) | Categories, budgets, rules |
| [property-tracking.md](how-to/property-tracking.md) | Real estate / asset NAV |
| [liabilities.md](how-to/liabilities.md) | Mortgages, loans, net worth |
| [dashboard-and-statistics.md](how-to/dashboard-and-statistics.md) | Dashboard / statistics / portfolio |
| [market-data-sync.md](how-to/market-data-sync.md) | EOD market sync |
| [tax-year-workflow.md](how-to/tax-year-workflow.md) | PL tax year workflow |
| [data-export.md](how-to/data-export.md) | Export and audit log |
| [account-sync.md](how-to/account-sync.md) | Sync / PSD2 stubs |
| [account-settings.md](how-to/account-settings.md) | Profile, email, password |
| [write-integration-tests.md](how-to/write-integration-tests.md) | Golden / integration tests |
| [private-deploy.md](how-to/private-deploy.md) | Private single-user deploy |

## Reference

| Doc | Use when |
|-----|----------|
| [api.md](reference/api.md) | REST route catalog |
| [domain.md](reference/domain.md) | Prisma models / enums |
| [frontend.md](reference/frontend.md) | UI routes and API clients |
| [testing.md](reference/testing.md) | Test pyramid, coverage, CI |
| [requirements.md](reference/requirements.md) | FR/NFR/DATA map |
| [environment.md](reference/environment.md) | Env vars, rate limits |
| [scripts.md](reference/scripts.md) | CLI and migrate deploy |

## Explanation

| Doc | Use when |
|-----|----------|
| [architecture.md](explanation/architecture.md) | Auth, FX, request flow |
| [fullstack-practices.md](explanation/fullstack-practices.md) | Fullstack practices rubric |
| [tax-pl.md](explanation/tax-pl.md) | PL tax assumptions |
| [portfolio-stats.md](explanation/portfolio-stats.md) | Dashboard KPIs / benchmarks |
| [fifo-cost-basis.md](explanation/fifo-cost-basis.md) | FIFO cost basis engine |

## Meta

| Doc | Use when |
|-----|----------|
| [code-map.md](meta/code-map.md) | Domain → primary code paths |

Full agent index (skills + rules): [AGENTS.md](../AGENTS.md).

## Page front matter

Every page under the folders above uses YAML front matter:

```yaml
---
diataxis: reference   # tutorial | how-to | reference | explanation | meta
use_when: short trigger for agents
audience: both        # agent | human | both
---
```

## Related

- Skills: see [AGENTS.md](../AGENTS.md) Skills table
- Maintenance: `.cursor/rules/docs-maintenance.mdc` + skill `docs-sync-during-work`
