# Accounts concepts

Static concepts for comparing shipped workflows without changing the production frontend.

| No. | Direction | Information architecture | State emphasis |
|---|---|---|---|
| 01 | [Financial inventory](01-financial-inventory/) | Register + inspector | Edit/API error |
| 02 | [Balance cards](02-balance-cards/) | Card collection | Create/validation |
| 03 | [Type portfolios](03-type-portfolios/) | Type workspaces | Filter/empty result |
| 04 | [Net worth hierarchy](04-net-worth-hierarchy/) | Hierarchy + summary | Complex portfolio |
| 05 | [Account command center](05-account-command-center/) | Operational console | Locked currency/edit |

## Shared constraints

- Static, responsive HTML/CSS with illustrative controls only.
- Mock data is coherent across topics: Everyday mBank, XTB Brokerage, IKE Retirement and Visa credit.
- Concepts use the authenticated shell and shared primitives from [`../_shared/`](../_shared/).
- Each demo links back to the [topic hub](./).
- The concepts only represent workflows documented as shipped; they do not add product behavior.
