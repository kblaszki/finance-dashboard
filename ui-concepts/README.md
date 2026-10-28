# UI concepts

Static HTML/CSS concept demos for information-architecture discussion. They do not ship with the React application.

## Topic map

| Topic | Status | Focus |
|---|---|---|
| [Dashboard](dashboard/) | Available · 26 concepts | Home overview, priorities and visual-system studies |
| [Landing](landing/) | Available · 5 concepts | Guest value proposition and product entry |
| [Login](login/) | Available · 5 concepts | Returning-user authentication |
| [Register](register/) | Available · 5 concepts | Account creation and empty-workspace expectations |
| [Accounts](accounts/) | Available · 5 concepts | Account collection, filtering and account creation |
| [Account detail](account-detail/) | Available · 5 concepts | Balance history, ledger and CSV import |
| [Transfers](transfers/) | Available · 5 concepts | Internal movements and cross-currency flows |
| [Categories](categories/) | Available · 5 concepts | Income/expense/transfer trees and description rules |
| [Tags](tags/) | Available · 5 concepts | Cross-cutting optional transaction labels |
| [Statistics](statistics/) | Available · 5 concepts | Period KPIs, cashflow and breakdowns |
| [Settings](settings/) | Available · 5 concepts | Profile, credentials and appearance |

## Open locally

Open any topic `index.html` directly with `file://`, or run `npx serve ui-concepts` and visit the topic route.

## Shared visual system

New concepts use [`_shared/tokens.css`](_shared/tokens.css) and [`_shared/primitives.css`](_shared/primitives.css). The primitives cover guest and authenticated shells, headers, cards, forms, buttons, tables, badges, filters, charts, trees, inspector panels, feedback banners, dialogs and empty states at the project breakpoints (`40rem`, `64rem`, `80rem`).

These artifacts are intentionally separate from `frontend/`; concept links and controls are illustrative.
