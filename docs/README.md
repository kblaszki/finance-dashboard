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

## How-to index

| Doc | Use when |
|-----|----------|
| [add-api-endpoint.md](how-to/add-api-endpoint.md) | New REST endpoint |
| [add-prisma-model.md](how-to/add-prisma-model.md) | Schema / model change |
| [add-ui-page.md](how-to/add-ui-page.md) | New UI page |
| [run-tests-and-coverage.md](how-to/run-tests-and-coverage.md) | Verification gate |
| [brokerage-and-fx.md](how-to/brokerage-and-fx.md) | Brokerage / FX work |
| [import-csv.md](how-to/import-csv.md) | Broker or bank CSV import |
| [tax-year-workflow.md](how-to/tax-year-workflow.md) | PL tax year workflow |
| [internal-transfers.md](how-to/internal-transfers.md) | Internal cash transfers |
| [private-deploy.md](how-to/private-deploy.md) | Private single-user deploy |

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
