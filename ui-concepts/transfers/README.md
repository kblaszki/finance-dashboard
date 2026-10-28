# Transfers concepts

Static concepts for comparing shipped workflows without changing the production frontend.

| No. | Direction | Information architecture | State emphasis |
|---|---|---|---|
| 01 | [Transfer register](01-transfer-register/) | Register + inline create | Populated/edit |
| 02 | [Guided composer](02-guided-composer/) | Guided form | Create/validation |
| 03 | [Money flow map](03-money-flow-map/) | Flow topology | Complex portfolio |
| 04 | [Transfer inbox](04-transfer-inbox/) | Import review | Duplicates/API feedback |
| 05 | [Operations console](05-operations-console/) | Console + detail | Prefill/empty prerequisite |

## Shared constraints

- Static, responsive HTML/CSS with illustrative controls only.
- Mock data is coherent across topics: Everyday mBank, XTB Brokerage, IKE Retirement and Visa credit.
- Concepts use the authenticated shell and shared primitives from [`../_shared/`](../_shared/).
- Each demo links back to the [topic hub](./).
- The concepts only represent workflows documented as shipped; they do not add product behavior.
