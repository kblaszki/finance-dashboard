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

**Code baseline:** JWT auth, account settings, multi-type accounts, cash ledger + categories, month statistics, demo user with sample portfolio. Product backlog: [mvp/CHECKLIST.md](../mvp/CHECKLIST.md) (do not treat checklist “done” as shipped code).

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
- Product feature map (backlog): [mvp/CHECKLIST.md](../mvp/CHECKLIST.md)

## Tutorials

| Doc | Use when |
|-----|----------|
| [first-run.md](tutorials/first-run.md) | First local install and login |
| [demo-seed.md](tutorials/demo-seed.md) | Demo user + sample portfolio (re-run wipes demo data) |

## How-to index

| Doc | Use when |
|-----|----------|
| [add-api-endpoint.md](how-to/add-api-endpoint.md) | New REST endpoint |
| [add-prisma-model.md](how-to/add-prisma-model.md) | Schema / model change |
| [add-ui-page.md](how-to/add-ui-page.md) | New UI page |
| [run-tests-and-coverage.md](how-to/run-tests-and-coverage.md) | Verification gate |
| [account-settings.md](how-to/account-settings.md) | Profile, email, password |
| [budgets-and-categories.md](how-to/budgets-and-categories.md) | Category tree + tag cash txs |
| [dashboard-and-statistics.md](how-to/dashboard-and-statistics.md) | Month category income/expense breakdown |
| [write-integration-tests.md](how-to/write-integration-tests.md) | HTTP / integration tests |
| [private-deploy.md](how-to/private-deploy.md) | Private single-user deploy |

## Reference

| Doc | Use when |
|-----|----------|
| [api.md](reference/api.md) | REST route catalog |
| [domain.md](reference/domain.md) | Prisma models |
| [frontend.md](reference/frontend.md) | UI routes and API clients |
| [testing.md](reference/testing.md) | Test pyramid, coverage, CI |
| [requirements.md](reference/requirements.md) | Shipped FRs vs mvp backlog |
| [environment.md](reference/environment.md) | Env vars, rate limits |
| [scripts.md](reference/scripts.md) | CLI and migrate deploy |

## Explanation

| Doc | Use when |
|-----|----------|
| [architecture.md](explanation/architecture.md) | Auth and request flow |
| [fullstack-practices.md](explanation/fullstack-practices.md) | Fullstack practices rubric |

## Meta

| Doc | Use when |
|-----|----------|
| [code-map.md](meta/code-map.md) | Domain → primary code paths |
