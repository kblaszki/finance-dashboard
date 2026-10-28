# Account detail concepts

Static concepts for comparing shipped workflows without changing the production frontend.

| No. | Direction | Information architecture | State emphasis |
|---|---|---|---|
| 01 | [Ledger workstation](01-ledger-workstation/) | Ledger + inline create | Populated/edit |
| 02 | [Balance story](02-balance-story/) | Chart narrative | Trend/month filter |
| 03 | [Statement view](03-statement-view/) | Monthly statement | Categories/tags |
| 04 | [Activity timeline](04-activity-timeline/) | Event timeline | Edit/API feedback |
| 05 | [Reconciliation cockpit](05-reconciliation-cockpit/) | Import/reconcile | Mapping/duplicates |

## Shared constraints

- Static, responsive HTML/CSS with illustrative controls only.
- Mock data is coherent across topics: Everyday mBank, XTB Brokerage, IKE Retirement and Visa credit.
- Concepts use the authenticated shell and shared primitives from [`../_shared/`](../_shared/).
- Each demo links back to the [topic hub](./).
- The concepts only represent workflows documented as shipped; they do not add product behavior.
